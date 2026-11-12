import { useEffect, useId, useRef, type ReactNode } from 'react';

export function WorkspaceDialog({ title, onClose, children, suspended=false }: { title: string; onClose: () => void; children: ReactNode; suspended?:boolean }) {
  const dialog=useRef<HTMLDialogElement>(null),label=useId();
  useEffect(()=>{const element=dialog.current;if(!suspended)element?.showModal();return()=>element?.close();},[suspended]);
  return <dialog ref={dialog} className="tw-modal" aria-labelledby={label} onCancel={event=>{event.preventDefault();onClose();}}><h2 id={label}>{title}</h2>{children}</dialog>;
}
