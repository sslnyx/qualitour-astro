import type {ComponentType} from 'react';
export type PendingNavigation={proceed:()=>void;reset:()=>void};
export type NavigationGuardComponent=ComponentType<{active:boolean;onBlocked:(pending:PendingNavigation)=>void}>;
