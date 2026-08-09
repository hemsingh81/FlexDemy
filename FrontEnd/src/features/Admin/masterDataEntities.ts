import { BookOpen, Building2, Globe2, GraduationCap, Layers, Map } from 'lucide-react';

export type MasterDataEntity = 'country' | 'state' | 'city' | 'board' | 'classlevel' | 'subject';

export const MASTER_DATA_ENTITIES: MasterDataEntity[] = ['country', 'state', 'city', 'board', 'classlevel', 'subject'];

export const MASTER_DATA_ENTITY_META: Record<MasterDataEntity, { label: string; icon: typeof Globe2 }> = {
  country: { label: 'Country', icon: Globe2 },
  state: { label: 'State', icon: Map },
  city: { label: 'City', icon: Building2 },
  board: { label: 'Board', icon: BookOpen },
  classlevel: { label: 'Class Level', icon: GraduationCap },
  subject: { label: 'Subject', icon: Layers },
};
