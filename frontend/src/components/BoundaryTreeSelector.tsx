import RegionTreeSelector, {
  type GeographicLevel,
  type SelectedBoundary,
  type RegionTreeSelectorProps,
  formatLevelPrefix,
  formatBadgeText,
  getBadgeStyle,
  DEFAULT_BOUNDARY,
} from './RegionTreeSelector';

export type { GeographicLevel, SelectedBoundary, RegionTreeSelectorProps };
export {
  formatLevelPrefix,
  formatBadgeText,
  getBadgeStyle,
  DEFAULT_BOUNDARY,
  RegionTreeSelector as BoundaryTreeSelector,
};
export default RegionTreeSelector;
