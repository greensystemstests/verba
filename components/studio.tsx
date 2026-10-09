'use client';
// The signed-in workspace. Each role gets its own menu and home (spec: customer area,
// delivery management 1.9–1.12, courier area 1.13, notary area 1.15–1.16, chat 1.17).
import {useCallback,useEffect,useMemo,useState} from 'react';
import {LayoutDashboard,Files,Truck,Scale,Users,BarChart3,Settings,Plus,MessageCircle,LogOut,Globe2,UserRound,Bike,Contact,RefreshCw,FolderOpen,MailWarning} from 'lucide-react';
import {toast} from 'sonner';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarInset,SidebarTrigger} from '@/components/ui/sidebar';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Skeleton} from '@/components/ui/skeleton';
import {Brand,api,json} from './verba-ui';
import {useT,LanguageSwitch} from './i18n';
import OrderForm from './order-form';
import OrderSheet from './studio/order-sheet';
import {OrdersView,NotaryView,ProjectsReport,Overview} from './studio/views-orders';
import {DeliveriesView,CouriersView,CustomersView,DeliveryReport,CourierArea} from './studio/views-deliveries';
import {InboxView,SupportView} from './studio/views-chat';
import {TeamView,SettingsView,ProfileView} from './studio/views-admin';
import type {ChatConversation} from './chat';
import type {WorkspaceInfo,OrderView,ShipmentView,Role} from './studio/types';
type View='overview'|'orders'|'new'|'deliveries'|'couriers'|'customers'|'notary'|'notary-reports'|'inbox'|'support'|'reports'|'team'|'settings'|'profile'|'courier'|'courier-reports';
const icons:Record<View,typeof Files>={overview:LayoutDashboard,orders:Files,new:Plus,deliveries:Truck,couriers:Bike,customers:Contact,notary:Scale,'notary-reports':BarChart3,inbox:MessageCircle,support:MessageCircle,reports:BarChart3,team:Users,settings:Settings,profile:UserRound,courier:Truck,'courier-reports':BarChart3};
const menus:Record<Role,[View,string][]>={
  admin:[['overview','Main'],['orders','Projects & quotes'],['deliveries','Deliveries'],['couriers','Couriers'],['customers','Customers'],['notary','Notary desk'],['inbox','Customer service'],['reports','Reports'],['team','Team'],['settings','Settings'],['profile','Personal information']],
  staff:[['overview','Main'],['orders','Projects & quotes'],['deliveries','Deliveries'],['couriers','Couriers'],['customers','Customers'],['notary','Notary desk'],['inbox','Customer service'],['reports','Reports'],['profile','Personal information']],
  customer:[['new','Create a new order'],['orders','Orders / offers'],['support','Customer service'],['profile','Personal information']],
  notary:[['notary','Main'],['notary-reports','Reports'],['profile','Personal information']],
  courier:[['courier','Deliveries'],['courier-reports','Reports'],['profile','Personal information']],
  vendor:[['orders','My assignments'],['profile','Personal information']],
  reviewer:[['orders','My assignments'],['profile','Personal information']],
};
const headings:Partial<Record<View,[string,string]>>={overview:['A little clarity. A lot of progress.','Every order, from first words to final delivery.'],orders:['Orders','Your quotes and orders, always within reach.'],new:['Create a new order','Choose a service and get a price in a few minutes.'],deliveries:['Deliveries','View active shipments and update existing shipments.'],couriers:['Couriers','Courier cards, active deliveries and mission history.'],customers:['Customers','Customers who ordered services or deliveries, and their activity.'],notary:['Notary work area','All orders open for notary care.'],'notary-reports':['Notary reports','Summary reports of notarial work.'],inbox:['Customer service','Conversations with customers in real time.'],support:['Customer service','Talk to our team about any order or question.'],reports:['Reports','Issue reports by customers, couriers, addresses and dates.'],team:['Team','Give every person the right access.'],settings:['Settings','Prices, languages and connections.'],profile:['Personal information','Your details, address and notification choices.'],courier:['Deliveries available','Deliveries in your area and the ones you are handling.'],'courier-reports':['My deliveries','All the deliveries you made.']};

export default function Studio(){
  const {t,dir}=useT();const router=useRouter();
  const [ws,setWs]=useState<WorkspaceInfo|null>(null);const [orders,setOrders]=useState<OrderView[]>([]);const [shipments,setShipments]=useState<ShipmentView[]>([]);const [conversations,setConversations]=useState<ChatConversation[]>([]);
  const [view,setView]=useState<View|null>(null);const [error,setError]=useState('');const [orderId,setOrderId]=useState<string|null>(null);const [conversation,setConversation]=useState<string|null>(null);
  const role=ws?.role;const staff=role==='admin'||role==='staff';
  const load=useCallback(async()=>{try{const w=await api('/api/workspace') as unknown as WorkspaceInfo;setWs(w);
    const [o,s,c]=await Promise.all([api('/api/orders'),['admin','staff','courier','customer'].includes(w.role)?api('/api/shipments'):Promise.resolve([]),['admin','staff','customer'].includes(w.role)?api('/api/chat?status=all'):Promise.resolve([])]);
    setOrders(o as unknown as OrderView[]);setShipments(s as unknown as ShipmentView[]);setConversations(c as unknown as ChatConversation[]);setError('');
    return w;}catch(e){setError(t((e as Error).message));return null;}},[t]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading: state changes after the requests finish
  useEffect(()=>{void load().then(w=>{if(!w)return;const p=new URLSearchParams(location.search);const asked=p.get('view') as View|null;const allowed=menus[w.role].map(m=>m[0]);
    setView(asked&&allowed.includes(asked)?asked:w.role==='customer'?'orders':allowed[0]);if(p.get('order'))setOrderId(p.get('order'));if(p.get('conversation'))setConversation(p.get('conversation'));});},[load]);
  useEffect(()=>{if(!ws||!['admin','staff','customer'].includes(ws.role))return;const timer=setInterval(()=>{if(document.visibilityState==='visible')api('/api/chat?status=all').then(c=>setConversations(c as unknown as ChatConversation[])).catch(()=>{});},20000);return ()=>clearInterval(timer);},[ws]);
  const go=(v:string)=>{setView(v as View);const url=new URL(location.href);url.searchParams.set('view',v);url.searchParams.delete('order');history.replaceState(null,'',url);};
  const open=(id:string)=>setOrderId(id);
  const unread=useMemo(()=>conversations.filter(c=>c.status==='open').reduce((n,c)=>n+(Number(c.unread)||0),0),[conversations]);
  const signOut=async()=>{try{await api('/api/auth/logout',json({}));router.push('/account');}catch(e){toast.error(t((e as Error).message));}};
  if(error&&!ws)return <main className="studio-error"><div role="alert" className="error-box"><h2>{t('We couldn’t load your workspace.')}</h2><p>{error}</p><button className="button secondary" onClick={()=>void load()}>{t('Try again')}</button></div></main>;
  if(!ws||!view)return <div className="loading-layout studio-loading"><Skeleton className="h-12 w-72"/><div className="stat-grid">{[1,2,3,4].map(i=><Skeleton className="h-32" key={i}/>)}</div><Skeleton className="h-80 w-full"/></div>;
  const menu=menus[ws.role];const [title,sub]=headings[view]||['',''];
  return <SidebarProvider className="studio-shell"><Sidebar className="studio-sidebar" side={dir==='rtl'?'right':'left'}><SidebarHeader><Brand/><div className="workspace-label">{ws.role==='customer'?t('CUSTOMER AREA'):ws.role==='courier'?t('COURIER AREA'):ws.role==='notary'?t('NOTARY AREA'):t('MANAGEMENT')}</div></SidebarHeader>
    <SidebarContent><SidebarMenu>{menu.map(([key,label])=>{const Icon=icons[key];const badge=key==='inbox'||key==='support'?unread:key==='orders'&&staff?orders.filter(o=>o.status==='Submitted').length:0;return <SidebarMenuItem key={key}><SidebarMenuButton isActive={view===key} onClick={()=>go(key)}><Icon size={18}/><span>{t(label)}</span>{badge>0&&<b className="nav-count">{badge}</b>}</SidebarMenuButton></SidebarMenuItem>;})}</SidebarMenu>
      {ws.role==='customer'&&<div className="sidebar-card banner"><FolderOpen size={26}/><h4>{ws.config.bannerTitle||t('Everything in one place.')}</h4><p>{ws.config.bannerText||t('Quotes, orders, documents and messages — always within reach.')}</p><a href="/services">{t('Explore our services')}</a></div>}
      {['admin','staff','customer','reviewer','vendor'].includes(ws.role)&&<div className="sidebar-links"><Link className="button secondary small" href="/"><Globe2 size={16}/>{t('AI translation studio')}</Link></div>}</SidebarContent>
    <SidebarFooter><div className="workspace-user"><span className="avatar">{(ws.user.name||'V')[0].toUpperCase()}</span><div><strong>{ws.user.name}</strong><small>{t(ws.role)}</small></div><button className="icon-button" aria-label={t('Log out')} onClick={signOut}><LogOut size={17} className="flip-rtl"/></button></div></SidebarFooter></Sidebar>
    <SidebarInset className="studio-inset"><header className="studio-topbar"><div><SidebarTrigger/><span className="topbar-user">{t('Username')}: <b>{ws.user.name}</b>{ws.user.company?`, ${ws.user.company}`:ws.role!=='customer'?`, ${ws.workspace}`:''}</span></div><div className="topbar-actions"><LanguageSwitch/>{(ws.role==='customer'||staff)&&view!=='new'&&<a className="button primary small" href={ws.role==='customer'?'/studio?view=new':'/order'} onClick={e=>{if(ws.role==='customer'){e.preventDefault();go('new');}}}><Plus size={15}/>{t('Create a new order')}</a>}<button className="button secondary small" onClick={signOut}><LogOut size={15} className="flip-rtl"/>{t('Log out')}</button></div></header>
      <main className="studio-main">
        {!ws.user.emailVerified&&ws.role==='customer'&&<div className="panel-notice verify-banner"><MailWarning size={17}/>{t('Please confirm your email address. We sent you a link when you registered.')} <button className="text-link" onClick={async()=>{try{const r=await api('/api/auth/verify',{method:'PUT'});toast.success(r.sent?t('We sent you a confirmation link.'):t('Email is not connected yet.'));}catch(e){toast.error(t((e as Error).message));}}}>{t('Send again')}</button></div>}
        <div className="workspace-heading"><div><span className="eyebrow">{t(ws.workspace)}</span><h1>{t(title)}</h1><p>{t(sub)}</p></div><button className="icon-button" onClick={()=>void load()} aria-label={t('Refresh')}><RefreshCw size={18}/></button></div>
        {view==='overview'&&<Overview orders={orders} shipments={shipments} unread={unread} ws={ws} go={go} open={open}/>}
        {view==='orders'&&<OrdersView orders={orders} ws={ws} open={open} customer={ws.role==='customer'}/>}
        {view==='new'&&<OrderForm embedded/>}
        {view==='deliveries'&&<DeliveriesView ws={ws} shipments={shipments} reload={()=>void load()}/>}
        {view==='couriers'&&<CouriersView ws={ws} shipments={shipments} reload={()=>void load()}/>}
        {view==='customers'&&<CustomersView ws={ws} shipments={shipments} reload={()=>void load()} orders={orders} open={open}/>}
        {view==='notary'&&<NotaryView orders={orders} ws={ws} open={open}/>}
        {view==='notary-reports'&&<NotaryView orders={orders} ws={ws} open={open} reports/>}
        {view==='inbox'&&<InboxView ws={ws} conversations={conversations} reload={()=>void load()} initial={conversation} open={open}/>}
        {view==='support'&&<SupportView conversations={conversations} reload={()=>void load()}/>}
        {view==='reports'&&<Tabs defaultValue="deliveries"><TabsList className="settings-tabs"><TabsTrigger value="deliveries">{t('Deliveries report')}</TabsTrigger><TabsTrigger value="projects">{t('Projects report')}</TabsTrigger><TabsTrigger value="notary">{t('Notary report')}</TabsTrigger></TabsList><TabsContent value="deliveries"><DeliveryReport ws={ws} shipments={shipments}/></TabsContent><TabsContent value="projects"><ProjectsReport orders={orders} ws={ws} open={open}/></TabsContent><TabsContent value="notary"><NotaryView orders={orders} ws={ws} open={open} reports/></TabsContent></Tabs>}
        {view==='team'&&<TeamView ws={ws} reload={()=>void load()}/>}
        {view==='settings'&&<SettingsView ws={ws} reload={()=>void load()}/>}
        {view==='profile'&&<ProfileView ws={ws}/>}
        {view==='courier'&&<CourierArea ws={ws} shipments={shipments} reload={()=>void load()}/>}
        {view==='courier-reports'&&<CourierArea ws={ws} shipments={shipments} reload={()=>void load()} reports/>}
      </main><footer className="workspace-footer"><span>{t('Verba · Meaning, without borders.')}</span><a href="/privacy">{t('Privacy notice')}</a></footer></SidebarInset>
    <OrderSheet id={orderId} ws={ws} onClose={()=>{setOrderId(null);const url=new URL(location.href);url.searchParams.delete('order');history.replaceState(null,'',url);}} onChanged={()=>void load()}/></SidebarProvider>;
}
