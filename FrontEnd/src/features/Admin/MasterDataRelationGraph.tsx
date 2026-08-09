import React from 'react';
import { ArrowRight, CornerDownRight } from 'lucide-react';
import type { MasterDataEntity } from './masterDataEntities';

// Shows the setup order dependency: Country -> State -> City, with Board branching
// optionally off State (national boards need no state), and Class Level / Subject
// standing alone with no prerequisites. Purely informational -- helps the admin know
// what to create first before e.g. a State dropdown appears empty.
interface NodeProps {
  label: string;
  entity: MasterDataEntity;
  activeEntity: MasterDataEntity;
  onSelect: (entity: MasterDataEntity) => void;
  muted?: boolean;
}

const Node: React.FC<NodeProps> = ({ label, entity, activeEntity, onSelect, muted }) => (
  <button
    type="button"
    onClick={() => onSelect(entity)}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
      activeEntity === entity
        ? 'bg-[#143358] text-white border-[#143358] shadow-md'
        : muted
        ? 'bg-white text-[#8A93A0] border-dashed border-[#E1DED4] hover:border-[#EC7B38]'
        : 'bg-[#FAF7EC] text-[#142030] border-[#E1DED4] hover:border-[#EC7B38]'
    }`}
  >
    {label}
  </button>
);

interface MasterDataRelationGraphProps {
  activeEntity: MasterDataEntity;
  onSelect: (entity: MasterDataEntity) => void;
}

export const MasterDataRelationGraph: React.FC<MasterDataRelationGraphProps> = ({ activeEntity, onSelect }) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-[#E1DED4] shadow-2xs space-y-3">
      <p className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">Setup order</p>

      <div className="flex flex-wrap items-center gap-2">
        <Node label="Country" entity="country" activeEntity={activeEntity} onSelect={onSelect} />
        <ArrowRight className="w-3.5 h-3.5 text-[#8A93A0] shrink-0" />
        <Node label="State" entity="state" activeEntity={activeEntity} onSelect={onSelect} />
        <ArrowRight className="w-3.5 h-3.5 text-[#8A93A0] shrink-0" />
        <Node label="City" entity="city" activeEntity={activeEntity} onSelect={onSelect} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6">
        <CornerDownRight className="w-3.5 h-3.5 text-[#8A93A0] shrink-0" />
        <span className="text-[11px] text-[#5E6A79]">State (optional)</span>
        <ArrowRight className="w-3.5 h-3.5 text-[#8A93A0] shrink-0" />
        <Node label="Board" entity="board" activeEntity={activeEntity} onSelect={onSelect} />
        <span className="text-[11px] text-[#8A93A0] italic">leave state blank for a national board</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-[#E1DED4]">
        <span className="text-[11px] text-[#5E6A79]">No prerequisites:</span>
        <Node label="Class Level" entity="classlevel" activeEntity={activeEntity} onSelect={onSelect} muted />
        <Node label="Subject" entity="subject" activeEntity={activeEntity} onSelect={onSelect} muted />
      </div>
    </div>
  );
};
