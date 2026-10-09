import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Compass,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  MapPin,
  Check,
  Globe,
  Layers,
} from 'lucide-react';
import {
  PHILIPPINES_REGION_TREE,
  RegionTreeNode,
  findRegionTreeNode,
  getRegionNodePath,
} from '@/utils/philippinesHierarchy';

interface RegionTreeSelectorProps {
  currentRegionKey: string;
  onSelectRegion: (key: string) => void;
  className?: string;
}

export default function RegionTreeSelector({
  currentRegionKey,
  onSelectRegion,
  className = '',
}: RegionTreeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Expanded nodes set: by default expand Visayas and Western Visayas so Panay provinces are readily visible
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    return new Set(['visayas', 'panay_guimaras', 'panay']);
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Auto-expand ancestors of active item on mount/change
  useEffect(() => {
    const activeNode = findRegionTreeNode(currentRegionKey);
    if (activeNode) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        // Ensure its parent is open
        if (activeNode.parentPath) {
          if (activeNode.parentPath.includes('Luzon')) next.add('luzon');
          if (activeNode.parentPath.includes('Visayas')) next.add('visayas');
          if (activeNode.parentPath.includes('Mindanao')) next.add('mindanao');
          if (activeNode.parentPath.includes('NCR')) next.add('ncr');
          if (activeNode.parentPath.includes('CAR')) next.add('car');
          if (activeNode.parentPath.includes('Region I')) next.add('r1');
          if (activeNode.parentPath.includes('Region II')) next.add('r2');
          if (activeNode.parentPath.includes('Region III')) next.add('central_luzon');
          if (activeNode.parentPath.includes('CALABARZON')) next.add('r4a');
          if (activeNode.parentPath.includes('MIMAROPA')) next.add('r4b');
          if (activeNode.parentPath.includes('Region V')) next.add('bicol');
          if (activeNode.parentPath.includes('Region VI') || activeNode.parentPath.includes('Western Visayas')) {
            next.add('panay_guimaras');
          }
          if (activeNode.parentPath.includes('Region VII') || activeNode.parentPath.includes('Central Visayas')) {
            next.add('central_visayas');
          }
          if (activeNode.parentPath.includes('Region VIII') || activeNode.parentPath.includes('Eastern Visayas')) {
            next.add('eastern_visayas');
          }
          if (activeNode.parentPath.includes('Region IX')) next.add('zamboanga_peninsula');
          if (activeNode.parentPath.includes('Region X')) next.add('northern_mindanao_caraga');
          if (activeNode.parentPath.includes('Region XI')) next.add('mindanao_south');
          if (activeNode.parentPath.includes('Region XII')) next.add('r12');
          if (activeNode.parentPath.includes('Region XIII')) next.add('r13');
          if (activeNode.parentPath.includes('BARMM')) next.add('barmm');
        }
        return next;
      });
    }
  }, [currentRegionKey]);

  const toggleExpand = (nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelect = (nodeId: string) => {
    onSelectRegion(nodeId);
    setIsOpen(false);
  };

  // Determine full display path for the trigger button
  const currentPathLabel = useMemo(() => {
    return getRegionNodePath(currentRegionKey);
  }, [currentRegionKey]);

  const currentNode = useMemo(() => {
    return findRegionTreeNode(currentRegionKey);
  }, [currentRegionKey]);

  // Filter tree nodes if search query is present
  const { filteredTree, autoExpandedIds } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return { filteredTree: PHILIPPINES_REGION_TREE, autoExpandedIds: new Set<string>() };
    }

    const autoExp = new Set<string>();

    function filterNode(node: RegionTreeNode): RegionTreeNode | null {
      const matchesSelf =
        node.name.toLowerCase().includes(q) ||
        (node.shortName && node.shortName.toLowerCase().includes(q)) ||
        (node.parentPath && node.parentPath.toLowerCase().includes(q));

      let matchingChildren: RegionTreeNode[] = [];
      if (node.children) {
        matchingChildren = node.children
          .map((child) => filterNode(child))
          .filter(Boolean) as RegionTreeNode[];
      }

      if (matchesSelf || matchingChildren.length > 0) {
        if (matchingChildren.length > 0) {
          autoExp.add(node.id);
        }
        return {
          ...node,
          children: matchingChildren.length > 0 ? matchingChildren : node.children,
        };
      }
      return null;
    }

    const filtered = PHILIPPINES_REGION_TREE
      .map((root) => filterNode(root))
      .filter(Boolean) as RegionTreeNode[];

    return { filteredTree: filtered, autoExpandedIds: autoExp };
  }, [searchQuery]);

  // When searching, auto-expand matching branches
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      return new Set([...expandedNodes, ...autoExpandedIds]);
    }
    return expandedNodes;
  }, [expandedNodes, autoExpandedIds, searchQuery]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id="panay-map-region-selector-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-ocean-500/35 bg-ocean-500/10 hover:bg-ocean-500/20 text-ocean-700 dark:text-ocean-200 transition-all cursor-pointer shadow-sm backdrop-blur-md max-w-full text-left active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ocean-500/40"
        aria-haspopup="tree"
        aria-expanded={isOpen}
        title={`Active Region: ${currentPathLabel}`}
      >
        <Compass className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400 shrink-0" />
        
        <span className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 hidden md:inline shrink-0">
          Region:
        </span>

        <span className="text-xs font-semibold text-slate-800 dark:text-white truncate max-w-[170px] xs:max-w-[210px] sm:max-w-[280px]">
          {currentNode?.name || currentPathLabel}
        </span>

        {currentNode?.type === 'province' && (
          <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-ocean-500/20 text-ocean-600 dark:text-ocean-300 font-bold uppercase tracking-wider hidden sm:inline shrink-0">
            Province
          </span>
        )}

        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-300 transition-transform duration-200 shrink-0 ml-0.5 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="tree"
          aria-label="Philippine Region and Province Selector"
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[310px] xs:w-[350px] sm:w-[390px] max-w-[calc(100vw-24px)] max-h-[460px] rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl z-[1500] flex flex-col overflow-hidden animate-fade-in text-slate-800 dark:text-slate-100"
        >
          {/* Header & Search Bar */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Globe className="h-3.5 w-3.5 text-sky-500" />
                <span>Geographic Scope & Boundary Tree</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors"
                aria-label="Close selector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search region, province, or city..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Breadcrumb Indicator of Active Target */}
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate font-mono">
              <span className="text-sky-600 dark:text-sky-400 font-semibold">Active:</span>
              <span className="truncate">{currentPathLabel}</span>
            </div>
          </div>

          {/* Hierarchical Scrollable Tree Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain no-scrollbar">
            {filteredTree.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching regions or provinces found for "{searchQuery}".
              </div>
            ) : (
              filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  currentRegionKey={currentRegionKey}
                  expandedNodes={effectiveExpanded}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelect}
                  depth={0}
                />
              ))
            )}
          </div>

          {/* Footer Helper Note */}
          <div className="px-3 py-2 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Tip: Click arrows to expand · Click name to zoom</span>
            <span className="font-semibold text-ocean-600 dark:text-ocean-400">Project SANAG</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tree Node Recursive Sub-Component ───────────────────────────────────────
interface TreeNodeItemProps {
  node: RegionTreeNode;
  currentRegionKey: string;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string, e?: React.MouseEvent) => void;
  onSelect: (nodeId: string) => void;
  depth: number;
}

function TreeNodeItem({
  node,
  currentRegionKey,
  expandedNodes,
  onToggleExpand,
  onSelect,
  depth,
}: TreeNodeItemProps) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedNodes.has(node.id);
  const isSelected =
    node.id.toLowerCase() === currentRegionKey.toLowerCase() ||
    (node.id === 'panay' && currentRegionKey === 'panay_guimaras');

  const paddingLeft = `${depth * 14 + 6}px`;

  // Visual badges based on node type
  const typeBadge =
    node.type === 'nationwide' ? (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 uppercase">
        Nationwide
      </span>
    ) : node.type === 'island_group' ? (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20 uppercase">
        Island Group
      </span>
    ) : node.type === 'region' ? (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/20">
        Region
      </span>
    ) : (
      <span className="px-1 py-0.2 rounded text-[9px] font-medium text-slate-400 dark:text-slate-500">
        Province
      </span>
    );

  return (
    <div className="space-y-0.5 select-none" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        style={{ paddingLeft }}
        className={`group flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs transition-all cursor-pointer ${
          isSelected
            ? 'bg-ocean-500/20 text-ocean-900 dark:text-white font-bold border border-ocean-500/40 shadow-sm'
            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
        }`}
        onClick={() => {
          // If island group, toggling expand feels more natural than selecting root
          if (node.type === 'island_group') {
            onToggleExpand(node.id);
          } else {
            onSelect(node.id);
          }
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Chevron expand/collapse toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => onToggleExpand(node.id, e)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-ocean-600 dark:text-ocean-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0 flex items-center justify-center">
              <MapPin className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
            </span>
          )}

          {/* Node name */}
          <span className="truncate flex-1 font-medium">{node.name}</span>
        </div>

        {/* Right side metadata badge and active checkmark */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {typeBadge}
          {isSelected && (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          )}
        </div>
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isExpanded && node.children && (
        <div className="border-l border-slate-200 dark:border-white/10 ml-3.5 pl-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              currentRegionKey={currentRegionKey}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
