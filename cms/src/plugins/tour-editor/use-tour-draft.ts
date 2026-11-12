import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { fetchContent, updateContent, acquireEntryLock, releaseEntryLock, useCurrentUser } from '@emdash-cms/admin';
import { TourDraftSession } from './draft-session';
import { LocalDraftStore } from './local-draft';

export function useTourDraft(id: string, locale: string) {
  const user=useCurrentUser();
  const persistence=useMemo(()=>{
    if(!user.data?.id)return {store:undefined,warning:'本機暫存未啟用：無法確認目前帳號。'};
    try{return {store:new LocalDraftStore(window.localStorage,user.data.id,crypto.randomUUID()),warning:''};}
    catch{return {store:undefined,warning:'瀏覽器不允許本機暫存，請保持頁面開啟並儲存草稿。'};}
  },[user.data?.id]);
  const session = useMemo(() => new TourDraftSession({
    load: (entryId, lang) => fetchContent('tours', entryId, { locale: lang||undefined }),
    save: (entryId, lang, payload) => updateContent('tours', entryId, payload, { locale: lang }),
    acquire: (entryId, lang, token) => acquireEntryLock('tours', entryId, { locale: lang, token }),
    release: (entryId, lang, token) => releaseEntryLock('tours', entryId, { locale: lang, token, keepalive: true }),
  },persistence.store,persistence.warning), [persistence]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    if(user.isPending)return;
    void session.load(id, locale,{resolveIdentity:true});
    const interval = setInterval(() => { void session.refreshLock(); }, 60000);
    return () => { clearInterval(interval); session.close(); };
  }, [id, locale, session, user.isPending]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (session.getSnapshot().dirty || session.getSnapshot().saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session]);
  return { state, session };
}
