import { readDays, type TourData } from './tour-editor-model.ts';
import { buildTourSave } from './tour-editor-fields.ts';
import { LocalDraftStore, type RecoveryRecord } from './local-draft.ts';
import { reconcileDraft, applyResolution, type Reconciliation } from './draft-reconcile.ts';

export type DraftEntry = { id: string; locale: string; data: TourData; _rev?: string; draftRevisionId?: string | null; liveRevisionId?: string | null; status: string; slug?: string | null; scheduledAt?: string | null; publishedAt?: string | null; seo?: {title?:string|null;description?:string|null;image?:string|null;canonical?:string|null;noIndex?:boolean} };
type Lease = { enabled: boolean; heldByCaller: boolean; holder?: { userName?: string | null } | null };
export type DraftTransport = {
  load(id: string, locale: string): Promise<DraftEntry>;
  acquire(id: string, locale: string, token: string): Promise<Lease>;
  release(id: string, locale: string, token: string): Promise<unknown>;
  save(id: string, locale: string, payload: { data: TourData; _rev: string }): Promise<DraftEntry>;
};
export type DraftState = {
  item: DraftEntry | null; base: TourData; draft: TourData; dirty: boolean;
  recovery: RecoveryRecord[]; localError: string; localSavedAt: number | null; comparing: boolean; comparison: { server: DraftEntry; result: Reconciliation; record?: RecoveryRecord } | null;
  loading: boolean; saving: boolean; operating: boolean; readOnly: boolean; conflict: boolean; error: string; savedAt: string | null;
};
const initial = (): DraftState => ({ item: null, base: {}, draft: {}, dirty: false, loading: true, saving: false, operating:false, readOnly: true, conflict: false, error: '', savedAt: null, recovery: [], localError: '', localSavedAt: null, comparing: false, comparison: null });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One entry-local writer; late requests cannot change a newer editor identity. */
export class TourDraftSession {
  private transport: DraftTransport;
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private lease: { id: string; locale: string; token: string } | null = null;
  private store?: LocalDraftStore;
  private storageWarning: string;
  private lockAllowed = false;
  private restored: RecoveryRecord[] = [];
  private compareGeneration = 0;
  constructor(transport: DraftTransport, store?: LocalDraftStore, storageWarning = '') { this.transport = transport; this.store=store; this.storageWarning=storageWarning; }
  private persist() {
    const item=this.state.item;if(!item||!this.store)return;
    try {
      if(this.state.dirty){this.store.write({entryId:item.id,locale:item.locale,baseRev:item._rev!,base:this.state.base,draft:this.state.draft});this.emit({localError:'',localSavedAt:Date.now()});}
      else {this.store.clearOwn(item.id,item.locale);this.emit({localError:'',localSavedAt:null});}
    }catch{this.emit({localError:'本機暫存失敗；內容仍在此頁，請保持頁面開啟並儲存草稿。',localSavedAt:null});}
  }
  private clearRestored() { if(!this.store)return;for(const record of this.restored)this.store.remove(record);this.restored=[]; }
  discard() {
    if(this.state.saving)return;
    this.emit({draft:structuredClone(this.state.base),dirty:false,comparison:null});
    try{this.clearRestored();}catch{this.emit({localError:'本機暫存清理失敗，重新開啟時請核對副本。'});}
    this.persist();
  }
  discardRecovery(key:string) {
    const record=this.state.recovery.find(r=>r.key===key);if(!record)return;
    try{this.store?.remove(record);this.emit({recovery:this.state.recovery.filter(r=>r.key!==key)});}catch{this.emit({localError:'無法移除本機副本，請檢查瀏覽器儲存空間。'});}
  }
  compareRecovery(key:string) { if(this.state.dirty){this.emit({error:'請先儲存或放棄目前修改，再恢復本機副本。'});return Promise.resolve();} const record=this.state.recovery.find(r=>r.key===key);return record?this.compare(record):Promise.resolve(); }
  compareLatest() { return this.compare(); }
  private async compare(record?:RecoveryRecord) {
    const item=this.state.item;if(!item||this.state.saving||this.state.comparing)return;
    const generation=this.generation,request=++this.compareGeneration,draft=this.state.draft;
    this.emit({comparing:true,error:''});
    try{
      const server=await this.transport.load(item.id,item.locale);
      if(generation!==this.generation||request!==this.compareGeneration||draft!==this.state.draft)return;
      if(server.id!==item.id||server.locale!==item.locale||!server._rev)throw new Error('最新版本資料不完整。');
      readDays(server.data);
      const result=reconcileDraft(record?.base||this.state.base,record?.draft||this.state.draft,server.data);
      this.emit({comparison:{server,result,...(record?{record}:{})}});
    }catch(error){if(generation===this.generation)this.emit({error:`無法對照最新內容，原修改仍保留。${error instanceof Error?error.message:''}`});}
    finally{if(generation===this.generation&&request===this.compareGeneration)this.emit({comparing:false});}
  }
  cancelComparison() { this.emit({comparison:null}); }
  applyComparison(choices:Record<string,'local'|'server'>) {
    const comparison=this.state.comparison;if(!comparison)return;
    const draft=applyResolution(comparison.result,choices);
    readDays(draft);
    if(comparison.record){this.restored.push(comparison.record);}
    this.emit({item:comparison.server,base:structuredClone(comparison.server.data),draft,dirty:!equal(draft,comparison.server.data),conflict:false,readOnly:!this.lockAllowed,error:this.lockAllowed?'':'目前沒有編輯權；已保留對照內容，請稍後重新讀取。',comparison:null,recovery:comparison.record?this.state.recovery.filter(r=>r.key!==comparison.record!.key):this.state.recovery});
    if(!this.state.dirty){try{this.clearRestored();}catch{this.emit({localError:'本機暫存清理失敗，重新開啟時請核對副本。'});}}
    this.persist();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(next: Partial<DraftState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()); }
  private release() {
    const lease = this.lease; this.lease = null;
    if (lease) void this.transport.release(lease.id, lease.locale, lease.token).catch(() => {});
  }
  async load(id: string, locale: string, options:{resolveIdentity?:boolean}={}) {
    const generation = ++this.generation;
    this.release(); this.lockAllowed=false; this.restored=[]; this.state = initial(); this.emit({ loading: true, localError:this.storageWarning });
    try {
      const item = await this.transport.load(id, locale);
      if (generation !== this.generation) return;
      const resolvedSlug=options.resolveIdentity&&!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id);
      const resolvedLocale=options.resolveIdentity&&!locale&&['en','zh'].includes(item.locale);
      if ((!resolvedSlug&&item.id!==id)||(!resolvedLocale&&item.locale!==locale)||!item.id||!item._rev) throw new Error('行程語言或版本資料不完整，請重新讀取。');
      readDays(item.data);
      const entryId=item.id,entryLocale=item.locale;
      const token = crypto.randomUUID();
      const lock = await this.transport.acquire(entryId, entryLocale, token);
      if (generation !== this.generation) { await this.transport.release(entryId, entryLocale, token); return; }
      const readOnly = lock.enabled && !lock.heldByCaller;
      this.lease = readOnly ? null : { id:entryId, locale:entryLocale, token };
      this.lockAllowed=!readOnly;
      let recovery:RecoveryRecord[]=[];let localError=this.storageWarning;
      try{recovery=this.store?.list(entryId,entryLocale).filter(record=>{if(equal(record.draft,item.data)){this.store?.remove(record);return false;}return true;})||[];localError=this.store?.warning||localError;}catch{localError="無法讀取本機暫存；仍可編輯並儲存至伺服器。";}
      this.emit({ item, base: structuredClone(item.data), draft: structuredClone(item.data), loading: false, readOnly, recovery, localError,
        error: readOnly ? `${lock.holder?.userName || '其他同事'}正在編輯此行程，目前為唯讀。` : '' });
    } catch (error) {
      if (generation === this.generation) this.emit({ loading: false, readOnly: true, error: error instanceof Error ? error.message : '行程載入失敗。' });
    }
  }
  patch(updater: (data: TourData) => TourData) {
    if (!this.state.item || this.state.readOnly || this.state.operating || this.state.comparing || this.state.comparison) return;
    const draft = updater(this.state.draft);
    readDays(draft);
    this.emit({ draft, dirty: !equal(draft, this.state.base) });
    this.persist();
  }
  async refreshLock(): Promise<boolean> {
    const lease = this.lease, generation = this.generation;
    if (!lease || this.state.conflict) return false;
    try {
      const lock = await this.transport.acquire(lease.id, lease.locale, lease.token);
      if (generation !== this.generation) { await this.transport.release(lease.id, lease.locale, lease.token); return false; }
      const allowed = !lock.enabled || lock.heldByCaller;
      this.lockAllowed=allowed;
      if (!allowed) this.emit({ readOnly: true, error: '編輯權已由其他同事取得；修改仍保留在此頁，請先處理衝突。' });
      return allowed;
    } catch {
      if (generation === this.generation) { this.lockAllowed=false; this.emit({ readOnly: true, error: '無法確認編輯權；修改仍保留，暫停儲存。' }); }
      return false;
    }
  }
  async save(): Promise<boolean> {
    if (this.state.saving || this.state.readOnly || this.state.comparing || this.state.comparison || !this.state.item) return false;
    if (!this.state.dirty) return true;
    const generation = this.generation, item = this.state.item;
    const snapshot = structuredClone(this.state.draft);
    this.emit({ saving: true, error: '' });
    try {
      const payload = buildTourSave(this.state.base, snapshot);
      if (!item._rev) throw new Error('缺少版本資料，無法儲存。');
      if (!await this.refreshLock()) return false;
      if (generation !== this.generation) return false;
      const result = await this.transport.save(item.id, item.locale, { ...payload, _rev: item._rev });
      if (generation !== this.generation) return false;
      if (result.id !== item.id || result.locale !== item.locale || !result._rev) throw new Error('儲存回應不完整，請重新確認行程狀態。');
      const laterChanges = Object.fromEntries(Object.entries(this.state.draft).filter(([key, value]) => !equal(value, snapshot[key])));
      const base = structuredClone(result.data), draft = { ...structuredClone(result.data), ...laterChanges };
      this.emit({ item: result, base, draft, dirty: !equal(base, draft), savedAt: new Date().toISOString() });
      try{this.clearRestored();}catch{this.emit({localError:'本機暫存清理失敗，重新開啟時請核對副本。'});}
      this.persist();
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      const conflict = (error as { status?: number })?.status === 409;
      this.emit({ conflict, readOnly: conflict || this.state.readOnly, error: conflict
        ? '版本衝突：其他分頁或同事已儲存修改。你的內容仍保留，請先對照最新內容再決定。'
        : `儲存失敗，修改仍保留在此頁。${error instanceof Error ? error.message : '請檢查連線後重試。'}` });
      return false;
    } finally { if (generation === this.generation) this.emit({ saving: false }); }
  }
  /** Settings and publication share the content writer and its lease/revision. */
  async loadDraftVersion(load:(item:DraftEntry)=>Promise<TourData>):Promise<boolean>{
    if(this.state.dirty||this.state.saving||this.state.readOnly||this.state.comparing||this.state.comparison||!this.state.item)return false;
    const generation=this.generation,item=this.state.item;
    this.emit({saving:true,operating:true,error:''});
    try{
      if(!await this.refreshLock()||generation!==this.generation)return false;
      const draft=await load(structuredClone(item));
      if(generation!==this.generation)return false;
      readDays(draft);
      this.emit({draft,dirty:!equal(draft,this.state.base)});this.persist();return true;
    }catch(error){if(generation===this.generation)this.emit({error:error instanceof Error?error.message:'版本載入失敗。'});return false;}
    finally{if(generation===this.generation)this.emit({saving:false,operating:false});}
  }
  async runEntryAction(action:(item:DraftEntry)=>Promise<DraftEntry>):Promise<boolean>{
    if(this.state.dirty||this.state.saving||this.state.readOnly||this.state.comparing||this.state.comparison||!this.state.item?._rev)return false;
    const generation=this.generation,item=this.state.item;
    this.emit({saving:true,operating:true,error:''});
    try{
      if(!await this.refreshLock()||generation!==this.generation)return false;
      const result=await action(structuredClone(item));
      if(generation!==this.generation)return false;
      if(result.id!==item.id||result.locale!==item.locale||!result._rev)throw new Error('操作回應不完整，請重新確認行程狀態。');
      readDays(result.data);
      this.emit({item:result,base:structuredClone(result.data),draft:structuredClone(result.data),dirty:false,savedAt:new Date().toISOString()});
      this.persist();return true;
    }catch(error){
      if(generation!==this.generation)return false;
      const conflict=(error as {status?:number})?.status===409;
      this.emit({conflict,readOnly:conflict||this.state.readOnly,error:conflict?'版本衝突，請對照最新內容後再操作。':`操作失敗。${error instanceof Error?error.message:'請重試。'}`});
      return false;
    }finally{if(generation===this.generation)this.emit({saving:false,operating:false});}
  }
  close() { ++this.generation; this.release(); }
}
