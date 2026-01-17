import React from 'react';
import { flushSync } from 'react-dom';
import TradeTypeSelector from './TradeTypeSelector';
import OnboardingTour, { PreseasonTourModal } from './OnboardingTour';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, DollarSign, TrendingDown, Ban, Trash2, Check, X, Loader2, RefreshCw, ChevronDown } from 'lucide-react';

// Helper function to format numbers with comma separators
const formatNumberWithCommas = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Position order for NRL Fantasy team display
const POSITION_CONFIG = {
  HOK: { label: 'HOK', count: 1, color: 'bg-primary', textColor: 'text-primary-foreground' },
  MID: { label: 'MID', count: 3, color: 'bg-primary', textColor: 'text-primary-foreground' },
  EDG: { label: 'EDG', count: 2, color: 'bg-primary', textColor: 'text-primary-foreground' },
  HLF: { label: 'HLF', count: 2, color: 'bg-amber-500', textColor: 'text-amber-950' },
  CTR: { label: 'CTR', count: 2, color: 'bg-primary', textColor: 'text-primary-foreground' },
  WFB: { label: 'WFB', count: 3, color: 'bg-primary', textColor: 'text-primary-foreground' },
  INT: { label: 'INT', count: 4, color: 'bg-purple-400', textColor: 'text-purple-950' },
  EMG: { label: 'EMG', count: 4, color: 'bg-orange-400', textColor: 'text-orange-950' },
};

const POSITION_ORDER = ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB', 'INT', 'EMG'];

// Available positions for trade-in requirements dropdown
const TRADE_IN_POSITION_OPTIONS = [
  { value: 'HOK', label: 'Hooker' },
  { value: 'MID', label: 'Middle' },
  { value: 'EDG', label: 'Edge' },
  { value: 'HLF', label: 'Halfback' },
  { value: 'CTR', label: 'Centre' },
  { value: 'WFB', label: 'Wing/Fullback' },
  { value: 'Any', label: 'Any Position' }
];

function TeamDisplay({
  players,
  onTradeOut,
  selectedTradeOutPlayers = [],
  selectionLimitReached = false,
  // Pre-season mode props
  isPreseasonMode = false,
  preseasonHighlighted = [],
  preseasonSelectedOut = [],
  preseasonTradedIn = [],
  preseasonPriorities = {},
  onPreseasonClick,
  // Player status indicator props
  injuredPlayers = [],
  urgentOvervaluedPlayers = [],
  overvaluedPlayers = [],
  notSelectedPlayers = [],
  junkCheapies = [],
  // Normal mode trade recommendations
  normalModeHighlighted = [],
  normalModePriorities = {},
  // Position dropdown props
  showPositionDropdown = null,
  positionRequirements = {},
  onPositionRequirementSelect,
  onCancelPositionRequirement,
  onPositionRequirementChange
}) {
  // Group players by their primary position
  const groupedPlayers = {};
  POSITION_ORDER.forEach(pos => {
    groupedPlayers[pos] = [];
  });

  // Assign players to positions based on their extracted position or order
  let playerIndex = 0;
  
  // First, try to place players by their detected position
  const unassigned = [];
  players.forEach(player => {
    const primaryPos = player.positions?.[0];
    if (primaryPos && groupedPlayers[primaryPos] && 
        groupedPlayers[primaryPos].length < POSITION_CONFIG[primaryPos]?.count) {
      groupedPlayers[primaryPos].push(player);
    } else {
      unassigned.push(player);
    }
  });

  // Fill remaining slots in order with unassigned players
  POSITION_ORDER.forEach(pos => {
    const config = POSITION_CONFIG[pos];
    while (groupedPlayers[pos].length < config.count && unassigned.length > 0) {
      groupedPlayers[pos].push(unassigned.shift());
    }
  });

  // Helper to check if player is in a list by name
  const isPlayerInList = (player, list) => {
    return list.some(p => p.name === player.name);
  };

  // Helper to check if player is injured (by name string match)
  const isPlayerInjured = (player) => {
    if (!player || !injuredPlayers || injuredPlayers.length === 0) return false;
    return injuredPlayers.some(injuredName => 
      injuredName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is urgent overvalued (very overvalued, Diff <= -7)
  const isPlayerUrgentOvervalued = (player) => {
    if (!player || !urgentOvervaluedPlayers || urgentOvervaluedPlayers.length === 0) return false;
    return urgentOvervaluedPlayers.some(name =>
      name.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is overvalued (moderately overvalued, -7 < Diff <= -1)
  const isPlayerOvervalued = (player) => {
    if (!player || !overvaluedPlayers || overvaluedPlayers.length === 0) return false;
    return overvaluedPlayers.some(name =>
      name.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is not selected (by name string match)
  const isPlayerNotSelected = (player) => {
    if (!player || !notSelectedPlayers || notSelectedPlayers.length === 0) return false;
    return notSelectedPlayers.some(notSelectedName =>
      notSelectedName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is a junk cheapie (by name string match)
  const isPlayerJunkCheap = (player) => {
    if (!player || !junkCheapies || junkCheapies.length === 0) return false;
    return junkCheapies.some(junkName =>
      junkName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Note: Removed useCallback to fix stale closure issue causing delayed visual updates
  // when selecting/deselecting players. The memoization was capturing old references
  // to selectedTradeOutPlayers, causing a one-interaction delay in UI updates.
  const renderPlayerCard = (player, position, index) => {
    if (!player) {
      return (
        <div key={`empty-${position}-${index}`} className="player-card relative flex flex-col items-center justify-center gap-2 rounded-lg bg-card/30 border border-primary/10 opacity-50 w-[75px] h-[75px]">
          <Badge className={cn(POSITION_CONFIG[position]?.color, POSITION_CONFIG[position]?.textColor, "px-2 py-1 text-xs font-bold")}>
            {position}
          </Badge>
          <span className="text-muted-foreground text-xs italic">Empty</span>
        </div>
      );
    }

    // Check player status
    const isInjured = isPlayerInjured(player);
    const isUrgentOvervalued = isPlayerUrgentOvervalued(player);
    const isOvervalued = isPlayerOvervalued(player);
    const isAnyOvervalued = isUrgentOvervalued || isOvervalued;
    const isNotSelected = isPlayerNotSelected(player);
    const isJunkCheap = isPlayerJunkCheap(player);

    // Check if player is highlighted in normal mode
    const isNormalModeHighlighted = normalModeHighlighted?.some(p => p.name === player.name);
    const normalModePriority = normalModePriorities?.[player.name];

    // Check if player is highlighted in preseason mode
    const isPreseasonHighlightedPlayer = preseasonHighlighted?.some(p => p.name === player.name);
    const preseasonPriority = preseasonPriorities?.[player.name];

    // Determine card classes using Tailwind
    const isSelected = !isPreseasonMode && selectedTradeOutPlayers.some(p => p.name === player.name);
    const isTradedIn = isPreseasonMode && isPlayerInList(player, preseasonTradedIn);
    const isPreseasonSelectedOut = isPreseasonMode && isPlayerInList(player, preseasonSelectedOut);
    const isHighlightedForTrade = isPreseasonMode ? isPlayerInList(player, preseasonHighlighted) : isNormalModeHighlighted;

    const cardClasses = cn(
      "player-card relative flex flex-col items-center justify-center gap-1.5 rounded-lg transition-all duration-200 cursor-pointer w-[75px] h-[75px]",
      "bg-card/50 border border-primary/20",
      "hover:bg-card/80 hover:border-primary/40 hover:scale-[1.02]",
      selectionLimitReached && !isSelected && !isPreseasonSelectedOut && "opacity-60 cursor-not-allowed hover:scale-100",
      // Both normal mode selected AND preseason selected use the same bright teal styling
      (isSelected || isPreseasonSelectedOut) && "bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/50",
      isTradedIn && "bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30",
      isHighlightedForTrade && !isSelected && !isPreseasonSelectedOut && isInjured && "bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/50",
      isHighlightedForTrade && !isSelected && !isPreseasonSelectedOut && !isInjured && "bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/50"
    );

    const handleClick = () => {
      if (isPreseasonMode && onPreseasonClick) {
        onPreseasonClick(player, position);
      } else if (onTradeOut) {
        onTradeOut(player, position);
      }
    };

    return (
      <div
        key={`${player.name}-${isSelected}-${isPreseasonSelectedOut}`}
        className={cardClasses}
        onClick={handleClick}
        data-player-name={player.name}
        data-is-selected={isSelected || isPreseasonSelectedOut}
      >
        {/* Priority indicator */}
        {(normalModePriority || (isPreseasonMode && preseasonPriority)) && (
          <div className="priority-indicator absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-lg z-10">
            {normalModePriority || preseasonPriority}
          </div>
        )}
        
        {/* Status indicators */}
        <TooltipProvider>
          <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
            {isInjured && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="injury-indicator w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                    <AlertTriangle className="w-3 h-3 text-amber-950" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Player injured</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isUrgentOvervalued && !isInjured && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="urgent-overvalued-indicator w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg text-xs">
                    🚨
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Very overvalued: losing money</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isOvervalued && !isInjured && !isUrgentOvervalued && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="lowupside-indicator w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                    <TrendingDown className="w-3 h-3 text-orange-950" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Overvalued</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isNotSelected && !isInjured && !isAnyOvervalued && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="not-selected-indicator w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                    <Ban className="w-3 h-3 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Not selected</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isJunkCheap && !isInjured && !isAnyOvervalued && !isNotSelected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="junk-cheap-indicator w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center shadow-lg text-xs">
                    💩
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Junk cheapie - trade out</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
        
        <Badge className={cn(POSITION_CONFIG[position]?.color, POSITION_CONFIG[position]?.textColor, "px-1.5 py-0 text-[10px] font-bold")}>
          {position}
        </Badge>
        <div className="text-center min-w-0 w-full px-1">
          <span className="player-name block text-foreground font-medium text-xs leading-tight truncate">{player.name}</span>
        </div>
        {player.price && (
          <span className="text-primary font-semibold text-xs">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
        )}
      </div>
    );
  };

  const renderPositionRow = (position) => {
    const config = POSITION_CONFIG[position];
    const posPlayers = groupedPlayers[position] || [];

    // Pad array to expected count
    const paddedPlayers = [...posPlayers];
    while (paddedPlayers.length < config.count) {
      paddedPlayers.push(null);
    }

    return (
      <div key={position} className="flex flex-nowrap justify-center gap-2 mb-3">
        {paddedPlayers.map((player, idx) => renderPlayerCard(player, position, idx))}
      </div>
    );
  };

  return (
    <div className="team-display space-y-1">
      <div className="team-field bg-gradient-field rounded-xl p-3 sm:p-4">
        {POSITION_ORDER.map(pos => renderPositionRow(pos))}
      </div>

      {/* Trade Type Selector Slide-up Panel */}
      {showPositionDropdown && (() => {
        const player = players.find(p => p.name === showPositionDropdown.playerName);
        return (
          <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
            <TradeTypeSelector
              player={player}
              slotPosition={showPositionDropdown.slotPosition}
              positionRequirements={positionRequirements}
              onPositionRequirementSelect={onPositionRequirementSelect}
              onCancelPositionRequirement={onCancelPositionRequirement}
              onPositionRequirementChange={onPositionRequirementChange}
            />
          </div>
        );
      })()}
    </div>
  );
}

function TradePanel({ 
  title, 
  subtitle, 
  players, 
  onSelect, 
  selectedPlayer, 
  selectedPlayers,
  selectedOptionIndex,
  onConfirmOption,
  emptyMessage, 
  isTradeOut, 
  isTradeIn,
  showConfirmButton
}) {
  return (
    <Card className="trade-panel border-primary/30 mt-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">{subtitle}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
            {players && players.length > 0 ? (
              isTradeOut ? (
                // Trade-out display
                players.map((player, index) => {
                  const isSelected = selectedPlayer?.name === player.name || selectedPlayers?.some(p => p.name === player.name);
                  return (
                    <div 
                      key={player.name || index}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer",
                        "bg-primary/5 hover:bg-primary/10",
                        isSelected && "bg-primary/20 ring-1 ring-primary"
                      )}
                      onClick={() => onSelect?.(player)}
                    >
                      <Badge variant="outline" className="px-2 py-0.5 text-xs shrink-0">
                        {player.positions?.[0] || '—'}
                      </Badge>
                      <span className="flex-1 text-sm text-foreground truncate">{player.name}</span>
                      {player.price && (
                        <span className="text-xs text-primary font-semibold shrink-0">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
                      )}
                      {player.reason && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded shrink-0",
                          player.reason === 'injured' ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {player.reason === 'injured' ? '⚠️' : `📉 ${player.diff?.toFixed(1)}`}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : isTradeIn ? (
                // Trade-in display (options with multiple players)
                players.map((option, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "trade-option p-3 rounded-lg transition-all cursor-pointer border",
                      "bg-card/50 border-primary/20 hover:border-primary/40",
                      selectedOptionIndex === index && "bg-primary/10 border-primary ring-1 ring-primary/50"
                    )}
                    onClick={() => onSelect?.(option, index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">Option {index + 1}</Badge>
                      <div className="flex gap-2">
                        {option.totalDiff && (
                          <span className="option-diff text-xs text-primary font-semibold">+{option.totalDiff.toFixed(1)}</span>
                        )}
                        {option.totalProjection && (
                          <span className="text-xs text-muted-foreground">Proj: {option.totalProjection.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {option.players.map((player, pIndex) => (
                        <div key={pIndex} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="px-1.5 py-0 text-xs shrink-0">{player.position}</Badge>
                          <span className="flex-1 text-foreground truncate">{player.name}</span>
                          <span className="text-xs text-primary shrink-0">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-primary/10 text-xs text-muted-foreground">
                      <span>Total: ${formatNumberWithCommas(Math.round(option.totalPrice / 1000))}k</span>
                      <span>Remaining: ${formatNumberWithCommas(Math.round(option.salaryRemaining / 1000))}k</span>
                    </div>
                    {showConfirmButton && selectedOptionIndex === index && (
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmOption?.();
                        }}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirm Trade
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                // Default display
                players.map((player, index) => (
                  <div 
                    key={player.name || index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer",
                      "bg-primary/5 hover:bg-primary/10",
                      selectedPlayer?.name === player.name && "bg-primary/20 ring-1 ring-primary"
                    )}
                    onClick={() => onSelect?.(player)}
                  >
                    <Badge variant="outline" className="px-2 py-0.5 text-xs">
                      {player.positions?.[0] || '—'}
                    </Badge>
                    <span className="flex-1 text-sm text-foreground">{player.name}</span>
                  </div>
                ))
              )
            ) : (
              <p className="text-center text-muted-foreground text-sm py-4">{emptyMessage}</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamView({ 
  players, 
  onBack,
  isTourActive = false,
  currentTourStep = 0,
  onTourNext,
  onTourPrevious,
  onTourSkip,
  onTourComplete
}) {
  const [teamPlayers, setTeamPlayers] = React.useState(players || []);
  const [cashInBank, setCashInBank] = React.useState(0);
  const [cashInBankDisplay, setCashInBankDisplay] = React.useState('');
  const [tradeOutRecommendations, setTradeOutRecommendations] = React.useState([]);
  const [tradeInRecommendations, setTradeInRecommendations] = React.useState([]);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [selectedStrategy, setSelectedStrategy] = React.useState('1'); // Default to Maximize Value
  const [numTrades, setNumTrades] = React.useState(2);
  const [targetByeRound, setTargetByeRound] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [showTradeModal, setShowTradeModal] = React.useState(false);
  const [showTradeInPage, setShowTradeInPage] = React.useState(false); // Trade-in recommendations page
  const [isCalculatingTradeOut, setIsCalculatingTradeOut] = React.useState(false);
  const [selectedTradeOutPlayers, setSelectedTradeOutPlayers] = React.useState([]);
  const [selectedTradeInIndex, setSelectedTradeInIndex] = React.useState(null);
  const [salaryCapRemaining, setSalaryCapRemaining] = React.useState(null);

  // Normal mode trade highlights
  const [normalModeHighlighted, setNormalModeHighlighted] = React.useState([]);
  const [normalModePriorities, setNormalModePriorities] = React.useState({});

  // Pre-season mode trade highlights and priorities
  const [preseasonHighlighted, setPreseasonHighlighted] = React.useState([]);
  const [preseasonPriorities, setPreseasonPriorities] = React.useState({});

  // Normal mode trade workflow state
  const [normalModePhase, setNormalModePhase] = React.useState('recommend'); // 'recommend' | 'calculate'
  const [hasCalculatedHighlights, setHasCalculatedHighlights] = React.useState(false);

  // Pre-season mode state
  const [isPreseasonMode, setIsPreseasonMode] = React.useState(false);
  const [preseasonHighlightedPlayers, setPreseasonHighlightedPlayers] = React.useState([]); // Up to 6 recommended trade-outs
  const [preseasonSelectedTradeOuts, setPreseasonSelectedTradeOuts] = React.useState([]); // Players user clicked to trade out
  const [preseasonAvailableTradeIns, setPreseasonAvailableTradeIns] = React.useState([]); // Flat list of trade-in candidates
  const [preseasonSelectedTradeIns, setPreseasonSelectedTradeIns] = React.useState([]); // Players selected to trade in
  const [preseasonSalaryCap, setPreseasonSalaryCap] = React.useState(0); // Dynamic salary cap
  const [preseasonPhase, setPreseasonPhase] = React.useState('idle'); // 'idle' | 'highlighting' | 'selecting-out' | 'selecting-in'
  const [showPreseasonTradeIns, setShowPreseasonTradeIns] = React.useState(false); // Show trade-in panel after confirming trade-outs
  const [preseasonTestApproach, setPreseasonTestApproach] = React.useState(false); // Test approach toggle - price band matching
  const [preseasonPriceBands, setPreseasonPriceBands] = React.useState([]); // Track price bands for test approach
  const [hasHighlightedPreseason, setHasHighlightedPreseason] = React.useState(false); // Track if preseason recommendations have been highlighted

  // Team status analysis state - front-loaded when team is displayed
  const [injuredPlayers, setInjuredPlayers] = React.useState([]);
  const [urgentOvervaluedPlayers, setUrgentOvervaluedPlayers] = React.useState([]);
  const [overvaluedPlayers, setOvervaluedPlayers] = React.useState([]);
  const [notSelectedPlayers, setNotSelectedPlayers] = React.useState([]);
  const [junkCheapies, setJunkCheapies] = React.useState([]);
  const [isAnalyzingTeam, setIsAnalyzingTeam] = React.useState(true);
  const [teamAnalysisComplete, setTeamAnalysisComplete] = React.useState(false);

  // Mobile strategy dropdown state
  const [showStrategyDropdown, setShowStrategyDropdown] = React.useState(false);
  const strategyDropdownRef = React.useRef(null);

  // Position requirements for INT/EMG players
  const [positionRequirements, setPositionRequirements] = React.useState({});
  const [showPositionDropdown, setShowPositionDropdown] = React.useState(null); // {playerName, position}

  // Find the first player with status indicators for tour step 2
  const firstIndicatorPlayer = React.useMemo(() => {
    if (!teamAnalysisComplete) return null;

    // Replicate the same player grouping logic as in the render
    const grouped = {};
    POSITION_ORDER.forEach(pos => { grouped[pos] = []; });
    const unassigned = [];

    teamPlayers.forEach(player => {
      const primaryPos = player.positions?.[0];
      if (primaryPos && grouped[primaryPos] && grouped[primaryPos].length < POSITION_CONFIG[primaryPos].count) {
        grouped[primaryPos].push(player);
      } else {
        unassigned.push(player);
      }
    });
    POSITION_ORDER.forEach(pos => {
      while (grouped[pos].length < POSITION_CONFIG[pos].count && unassigned.length > 0) {
        grouped[pos].push(unassigned.shift());
      }
    });

    // Check in priority order: HOK → MID → EDG → HLF
    const targetPositions = ['HOK', 'MID', 'EDG', 'HLF'];
    for (const pos of targetPositions) {
      for (const player of grouped[pos] || []) {
        if (player && (
          injuredPlayers.includes(player.name) ||
          urgentOvervaluedPlayers.includes(player.name) ||
          overvaluedPlayers.includes(player.name) ||
          notSelectedPlayers.includes(player.name) ||
          junkCheapies.includes(player.name)
        )) {
          return player;
        }
      }
    }

    // Ultimate fallback: first player in HOK row
    return grouped['HOK']?.[0] || null;
  }, [
    teamPlayers,
    injuredPlayers,
    urgentOvervaluedPlayers,
    overvaluedPlayers,
    notSelectedPlayers,
    junkCheapies,
    teamAnalysisComplete
  ]);

  const renderPlayerCard = (player, position, index) => {
    if (!player) {
      return (
        <div key={`empty-${position}-${index}`} className="player-card empty">
          <div className="position-badge" style={{ background: POSITION_CONFIG[position]?.color }}>
            {position}
          </div>
          <div className="player-info">
            <span className="empty-slot">Empty</span>
          </div>
        </div>
      );
    }

    // Check player status
    const isInjured = isPlayerInjured(player);
    const isUrgentOvervalued = isPlayerUrgentOvervalued(player);
    const isOvervalued = isPlayerOvervalued(player);
    const isAnyOvervalued = isUrgentOvervalued || isOvervalued;
    const isNotSelected = isPlayerNotSelected(player);
    const isJunkCheap = isPlayerJunkCheap(player);

    // Check if player is highlighted in normal mode
    const isNormalModeHighlighted = normalModeHighlighted?.some(p => p.name === player.name);
    const normalModePriority = normalModePriorities?.[player.name];

    // Check if player is highlighted in preseason mode
    const isPreseasonHighlightedPlayer = preseasonHighlighted?.some(p => p.name === player.name);
    const preseasonPriority = preseasonPriorities?.[player.name];

    // Determine CSS classes based on preseason mode state
    let cardClasses = 'player-card';

    // Add selection limit class for hover effects
    if (selectionLimitReached) {
      cardClasses += ' selection-limit-reached';
    }

    if (isPreseasonMode) {
      // Check if this player was traded in (replaces a traded out player)
      if (isPlayerInList(player, preseasonTradedIn)) {
        cardClasses += ' preseason-traded-in';
      }
      // Check if player is selected for trade out
      else if (isPlayerInList(player, preseasonSelectedOut)) {
        // Use different selected styles based on whether injured or overvalued
        if (isInjured) {
          cardClasses += ' preseason-selected-out-injured';
        } else {
          cardClasses += ' preseason-selected-out-lowupside';
        }
      }
      // Check if player is highlighted as a trade-out recommendation
      else if (isPlayerInList(player, preseasonHighlighted)) {
        // Use different highlight styles based on whether injured or overvalued
        if (isInjured) {
          cardClasses += ' preseason-highlight-injured';
        } else {
          cardClasses += ' preseason-highlight-lowupside';
        }
      }
    } else {
      // Normal mode - check for highlighting and selection
      const isSelected = selectedTradeOutPlayers.some(p => p.name === player.name);
      if (isSelected) {
        cardClasses += ' selected';
      } else if (isNormalModeHighlighted) {
        // Use different highlight styles based on player status
        if (isInjured) {
          cardClasses += ' preseason-highlight-injured';
        } else {
          cardClasses += ' preseason-highlight-lowupside';
        }
      }
    }

    const handleClick = () => {
      if (isPreseasonMode && onPreseasonClick) {
        onPreseasonClick(player, position);
      } else if (onTradeOut) {
        onTradeOut(player, position);
      }
    };

    // Check if this player has position requirements set
    const hasPositionRequirements = positionRequirements[player.name];

    return (
      <div
        key={player.name}
        className={cardClasses}
        onClick={handleClick}
        data-player-name={player.name}
      >
        {/* Priority indicator for normal mode trade recommendations */}
        {normalModePriority && (
          <div className="priority-indicator">
            {normalModePriority}
          </div>
        )}
        {/* Priority indicator for preseason mode trade recommendations */}
        {isPreseasonMode && preseasonPriority && (
          <div className="priority-indicator">
            {preseasonPriority}
          </div>
        )}
        {/* Injury indicator - warning triangle with exclamation mark */}
        {isInjured && (
          <div className="injury-indicator">
            <svg viewBox="0 0 24 24" className="warning-icon">
              {/* Warning triangle */}
              <path d="M12 2L22 20H2L12 2Z" fill="#ff9800"/>
              {/* Exclamation mark */}
              <path d="M12 8V14" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="1" fill="#000000"/>
            </svg>
            <div className="tooltip">player injured</div>
          </div>
        )}
        {/* Urgent overvalued indicator - alarm emoji (Diff <= -7) */}
        {isUrgentOvervalued && !isInjured && (
          <div className="urgent-overvalued-indicator">
            🚨
            <div className="tooltip">Very overvalued: losing money</div>
          </div>
        )}
        {/* Overvalued indicator - green banknote with red arrow (-7 < Diff <= -1) */}
        {isOvervalued && !isInjured && !isUrgentOvervalued && (
          <div className="lowupside-indicator">
            <svg viewBox="0 0 24 24" className="lowupside-icon">
              {/* Banknote (green) */}
              <rect x="2" y="6" width="14" height="10" rx="1" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.5"/>
              <circle cx="9" cy="11" r="2.5" fill="#2E7D32"/>
              <text x="9" y="12.5" textAnchor="middle" fontSize="4" fill="#fff" fontWeight="bold">$</text>
              {/* Downward arrow (red) */}
              <path d="M18 4 L18 16 L14 12 M18 16 L22 12" stroke="#e53935" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="tooltip">overvalued</div>
          </div>
        )}
        {/* Not selected indicator - prohibition symbol */}
        {isNotSelected && !isInjured && !isAnyOvervalued && (
          <div className="not-selected-indicator">
            <svg viewBox="0 0 24 24" className="prohibition-icon">
              {/* Circle */}
              <circle cx="12" cy="12" r="10" fill="none" stroke="#e53935" strokeWidth="2"/>
              {/* Diagonal line */}
              <path d="M7 7L17 17" stroke="#e53935" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="tooltip">not selected</div>
          </div>
        )}
        {/* Junk cheapies indicator - poo emoji */}
        {isJunkCheap && !isInjured && !isAnyOvervalued && !isNotSelected && (
          <div className="junk-cheap-indicator">
            💩
            <div className="tooltip">junk cheapie - trade out</div>
          </div>
        )}
        <div className="position-badge" style={{ background: POSITION_CONFIG[position]?.color }}>
          {position}
        </div>
        <div className="player-info">
          <span className="player-name">{player.name}</span>
        {player.price && (
          <span className="player-price">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
        )}
        {/* Position requirements indicator for INT/EMG players */}
        {hasPositionRequirements && (
          <div className="position-requirements-indicator">
            <span className="position-requirements-text">
              Trade-in: {hasPositionRequirements.length === 6 ? 'Any' : hasPositionRequirements.join('/')}
            </span>
          </div>
        )}
        </div>
      </div>
    );
  };

  React.useEffect(() => {
    setTeamPlayers(players || []);
    // Reset analysis state when players change
    if (players && players.length > 0) {
      setTeamAnalysisComplete(false);
      setIsAnalyzingTeam(true);
    }
  }, [players]);

  // Front-load team analysis (injured + overvalued) when team players are loaded
  React.useEffect(() => {
    const analyzeTeam = async () => {
      if (!teamPlayers || teamPlayers.length === 0) {
        setInjuredPlayers([]);
        setUrgentOvervaluedPlayers([]);
        setOvervaluedPlayers([]);
        setNotSelectedPlayers([]);
        setJunkCheapies([]);
        setNormalModeHighlighted([]);
        setNormalModePriorities({});
        setIsAnalyzingTeam(false);
        setTeamAnalysisComplete(true);
        return;
      }

      setIsAnalyzingTeam(true);
      try {
        const { analyzeTeamStatus } = await import('../services/tradeApi.js');
        const result = await analyzeTeamStatus(teamPlayers);
        setInjuredPlayers(result.injured_players || []);
        setUrgentOvervaluedPlayers(result.urgent_overvalued_players || []);
        setOvervaluedPlayers(result.overvalued_players || []);
        setNotSelectedPlayers(result.not_selected_players || []);
        setJunkCheapies(result.junk_cheapies || []);
        console.log('Team analysis complete:', result);
        console.log('Urgent overvalued players:', result.urgent_overvalued_players || []);
        console.log('Overvalued players:', result.overvalued_players || []);
        console.log('Not selected players:', result.not_selected_players || []);
        console.log('Junk cheapies:', result.junk_cheapies || []);
      } catch (err) {
        console.error('Error analyzing team:', err);
        setInjuredPlayers([]);
        setUrgentOvervaluedPlayers([]);
        setOvervaluedPlayers([]);
        setNotSelectedPlayers([]);
        setJunkCheapies([]);
        setNormalModeHighlighted([]);
        setNormalModePriorities({});
      } finally {
        setIsAnalyzingTeam(false);
        setTeamAnalysisComplete(true);
      }
    };

    analyzeTeam();
  }, [teamPlayers]);

  // Handle click outside strategy dropdown to close it
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (strategyDropdownRef.current && !strategyDropdownRef.current.contains(event.target)) {
        setShowStrategyDropdown(false);
      }
    };

    if (showStrategyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStrategyDropdown]);

  // Reset preseason state when mode is toggled off
  React.useEffect(() => {
    if (!isPreseasonMode) {
      setPreseasonHighlightedPlayers([]);
      setPreseasonSelectedTradeOuts([]);
      setPreseasonAvailableTradeIns([]);
      setPreseasonSelectedTradeIns([]);
      setPreseasonSalaryCap(0);
      setPreseasonPhase('idle');
      setShowPreseasonTradeIns(false);
      setPreseasonTestApproach(false);
      setPreseasonPriceBands([]);
      setHasHighlightedPreseason(false);
      setPreseasonHighlighted([]);
      setPreseasonPriorities({});
      setPositionRequirements({});
      setShowPositionDropdown(null);
    } else {
      // Clear normal mode highlights when entering preseason mode
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
      setHasHighlightedPreseason(false);
    }
  }, [isPreseasonMode]);

  // Reset normal mode phase when players change
  React.useEffect(() => {
    if (!isPreseasonMode) {
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
      setTradeOutRecommendations([]);
      setSelectedTradeOutPlayers([]);
      setPositionRequirements({});
    }
  }, [teamPlayers]);

  // Handle cash in bank input with formatting
  const handleCashChange = (e) => {
    const value = e.target.value;
    // Extract numeric value only
    const numericValue = value.replace(/[^0-9]/g, '');
    const parsedValue = parseInt(numericValue) || 0;
    
    // Update numeric state
    setCashInBank(parsedValue);
    
    // Update display value with formatting
    if (numericValue === '' || parsedValue === 0) {
      setCashInBankDisplay('');
    } else {
      setCashInBankDisplay(`$ ${formatNumberWithCommas(parsedValue)} k`);
    }
  };

  // Handle trade workflow button - no modal in normal mode
  const handleMakeATrade = async () => {
    // In preseason mode, if we haven't highlighted recommendations yet, highlight them
    if (isPreseasonMode && !hasHighlightedPreseason) {
      handleHighlightOptions();
      return;
    }

    // In preseason mode after highlighting, confirm trade-outs and show trade-in options
    if (isPreseasonMode && hasHighlightedPreseason) {
      handleConfirmPreseasonTradeOuts();
      return;
    }

    // In normal mode, if we're still in the recommend phase, run highlight flow in-place
    if (normalModePhase === 'recommend') {
      handleTradeWorkflow();
      return;
    }

    // In normal mode calculate phase - go directly to trade-in page (skip modal)
    if (selectedTradeOutPlayers.length > 0) {
      setIsCalculating(true);
      setError(null);
      
      try {
        const { calculateTeamTrades } = await import('../services/tradeApi.js');
        
        const result = await calculateTeamTrades(
          teamPlayers,
          cashInBank * 1000,
          selectedStrategy,
          selectedTradeOutPlayers.length,
          null,
          targetByeRound,
          false, // preseasonMode
          selectedTradeOutPlayers || []
        );

        setTradeInRecommendations(result.trade_in);
        setShowTradeInPage(true); // Go directly to trade-in page
        
        // Advance tour if active
        if (isTourActive && currentTourStep === 10 && onTourNext) {
          setTimeout(() => {
            onTourNext(); // Advance to step 11 (trade-in page)
          }, 500);
        }
      } catch (err) {
        console.error('Error calculating trade recommendations:', err);
        setError(err.message || 'Failed to calculate trade recommendations');
      } finally {
        setIsCalculating(false);
      }
    }
  };

  // Handle the trade recommendation workflow
  const handleTradeWorkflow = async () => {
    setIsCalculating(true);
    setError(null);

    try {
      if (!isPreseasonMode && normalModePhase === 'recommend') {
        // Phase 1: Just highlight players, don't calculate trade recommendations
        // Combine all players that have issues: injured + overvalued (urgent + regular) + not selected + junk cheapies
        const allProblemPlayers = new Set([
          ...injuredPlayers,
          ...urgentOvervaluedPlayers,
          ...overvaluedPlayers,
          ...notSelectedPlayers,
          ...junkCheapies
        ]);

        // Find the actual player objects from teamPlayers that match these names
        const highlightedPlayers = teamPlayers.filter(player =>
          allProblemPlayers.has(player.name)
        );

        // Helper to get player's urgency priority based on category and price
        // Priority hierarchy (lower number = higher urgency):
        // 1. Very overvalued (urgent overvalued) - any price
        // 2. Injured AND price > $300k
        // 3. Not selected AND price > $300k
        // 4. Overvalued AND price > $300k
        // 5. Overvalued AND price <= $300k
        // 6. Injured AND price <= $300k
        // 7. Not selected AND price <= $300k
        // 8. Junk cheapies
        const PRICE_THRESHOLD = 300000;
        const getUrgencyScore = (playerName) => {
          const player = teamPlayers.find(p => p.name === playerName);
          const price = player?.price || 0;
          const isHighValue = price > PRICE_THRESHOLD;
          
          // Check categories (in priority order)
          const isUrgentOvervalued = urgentOvervaluedPlayers.includes(playerName);
          const isInjured = injuredPlayers.includes(playerName);
          const isNotSelected = notSelectedPlayers.includes(playerName);
          const isOvervalued = overvaluedPlayers.includes(playerName);
          const isJunkCheapie = junkCheapies.includes(playerName);
          
          if (isUrgentOvervalued) return 1;
          if (isInjured && isHighValue) return 2;
          if (isNotSelected && isHighValue) return 3;
          if (isOvervalued && isHighValue) return 4;
          if (isOvervalued && !isHighValue) return 5;
          if (isInjured && !isHighValue) return 6;
          if (isNotSelected && !isHighValue) return 7;
          if (isJunkCheapie) return 8;
          return 9; // fallback
        };

        // Sort highlighted players by urgency score, then by price (higher price first within same score)
        const sortedPlayers = [...highlightedPlayers].sort((a, b) => {
          const scoreA = getUrgencyScore(a.name);
          const scoreB = getUrgencyScore(b.name);
          if (scoreA !== scoreB) return scoreA - scoreB;
          // Within same urgency, prioritize higher priced players
          return (b.price || 0) - (a.price || 0);
        });

        // Assign priorities based on sorted order
        const priorities = {};
        sortedPlayers.forEach((player, index) => {
          priorities[player.name] = index + 1;
        });

        setNormalModeHighlighted(highlightedPlayers);
        setNormalModePriorities(priorities);
        setTradeOutRecommendations([]);
        setSelectedTradeOutPlayers([]);
        setHasCalculatedHighlights(true);
        setNormalModePhase('calculate');
        
        // Advance tour if active
        if (isTourActive && currentTourStep === 3 && onTourNext) {
          setTimeout(() => {
            onTourNext(); // Advance to step 4 (priority numbers)
          }, 500);
        }
        
        // Close modal on mobile after highlighting so the team view is visible
        if (showTradeModal) {
          setShowTradeModal(false);
        }

      } else {
        // Phase 2: Calculate trade-in recommendations based on user's selected trade-outs
        const { calculateTeamTrades } = await import('../services/tradeApi.js');

        const result = await calculateTeamTrades(
          teamPlayers,
          cashInBank * 1000,
          selectedStrategy,
          selectedTradeOutPlayers.length,
          null,
          targetByeRound,
          false, // preseasonMode
          selectedTradeOutPlayers || [] // preselected trade-outs
        );

        // Set trade-in recommendations based on user's selections
        setTradeInRecommendations(result.trade_in);

        // Advance tour if active
        if (isTourActive && currentTourStep === 10 && onTourNext) {
          setTimeout(() => {
            onTourNext(); // Advance to step 11 (trade-in page)
          }, 500);
        }

        // On mobile, close modal and show trade-in recommendations page
        if (showTradeModal) {
          setShowTradeModal(false);
          setShowTradeInPage(true);
        }
      }
    } catch (err) {
      console.error('Error in trade workflow:', err);
      setError(err.message || 'Failed to process trade recommendations');
    } finally {
      setIsCalculating(false);
    }
  };


  // Using flushSync to force immediate synchronous state updates and re-renders
  // This ensures the UI updates immediately when a player is selected/deselected
  const handleTradeOut = (player, position) => {
    if (!player) return;

    // Only allow selection of highlighted players in normal mode
    if (!isPreseasonMode && !normalModeHighlighted.some(p => p.name === player.name)) {
      return;
    }

    const exists = selectedTradeOutPlayers.some(p => p.name === player.name);
    
    if (exists) {
      // Allow deselection even if at limit - use flushSync for immediate UI update
      flushSync(() => {
        setSelectedTradeOutPlayers(prev => prev.filter(p => p.name !== player.name));
      });
      // Clear position requirements for deselected player
      setPositionRequirements(prev => {
        const newReqs = { ...prev };
        delete newReqs[player.name];
        return newReqs;
      });
    } else if (selectedTradeOutPlayers.length < (isPreseasonMode ? 6 : numTrades)) {
      // Advance tour if this is first selection
      if (isTourActive && currentTourStep === 5 && selectedTradeOutPlayers.length === 0 && onTourNext) {
        setTimeout(() => {
          onTourNext(); // Advance to step 6 (calculate button)
        }, 300);
      }
      // For INT/EMG players, show position dropdown first
      if (position === 'INT' || position === 'EMG') {
        setShowPositionDropdown({ playerName: player.name, slotPosition: position });
        return;
      }
      // For positional players, add directly with automatic position requirement
      // Use flushSync for immediate UI update
      flushSync(() => {
        setSelectedTradeOutPlayers(prev => [...prev, {
          ...player,
          originalPosition: position,
          trade_in_positions: [position]  // Positional players require same position replacement
        }]);
      });
    }
    // If not exists and at limit, do nothing
  };

  const handleTradeIn = (option, index) => {
    setSelectedTradeInIndex(index);
  };

  // Handle position requirement selection for INT/EMG players
  const handlePositionRequirementSelect = (player, selectedPositions) => {
    // Convert 'Any' to all positions
    const tradeInPositions = selectedPositions.includes('Any')
      ? ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB']
      : selectedPositions.filter(pos => pos !== 'Any');

    if (isPreseasonMode) {
      // Add player to preseason selected trade-out players
      setPreseasonSelectedTradeOuts(prev => [...prev, {
        ...player,
        originalPosition: showPositionDropdown.slotPosition,
        trade_in_positions: tradeInPositions
      }]);
    } else {
      // Add player to selected trade-out players with position requirements
      setSelectedTradeOutPlayers(prev => [...prev, {
        ...player,
        originalPosition: showPositionDropdown.slotPosition,
        trade_in_positions: tradeInPositions
      }]);
    }

    // Store position requirements
    setPositionRequirements(prev => ({
      ...prev,
      [player.name]: tradeInPositions
    }));

    // Close the dropdown
    setShowPositionDropdown(null);
  };

  // Handle position requirement changes (checkbox toggles)
  const handlePositionRequirementChange = (playerName, newSelections) => {
    setPositionRequirements(prev => ({
      ...prev,
      [playerName]: newSelections
    }));
  };

  // Handle canceling position requirement selection
  const handleCancelPositionRequirement = (player) => {
    // Clear position requirements for the player
    setPositionRequirements(prev => {
      const newReqs = { ...prev };
      delete newReqs[player.name];
      return newReqs;
    });

    // Deselect the player from trade-out selection
    setSelectedTradeOutPlayers(prev => prev.filter(p => p.name !== player.name));

    // Close the dropdown
    setShowPositionDropdown(null);
  };

  const handleConfirmTrade = () => {
    const selectedOption = selectedTradeInIndex !== null
      ? tradeInRecommendations[selectedTradeInIndex]
      : null;

    if (!selectedOption) return;

    const tradeInPlayers = (selectedOption.players || []).map(player => ({
      name: player.name,
      positions: player.positions || (player.position ? [player.position] : []),
      price: player.price
    }));

    const expectedTradeCount = tradeInPlayers.length || numTrades;
    const tradeOutList = selectedTradeOutPlayers.length > 0
      ? selectedTradeOutPlayers.slice(0, expectedTradeCount)
      : tradeOutRecommendations.slice(0, expectedTradeCount);

    // Swap trade-outs with trade-ins in-place where possible
    const updatedTeam = [...teamPlayers];
    const minLength = Math.min(tradeOutList.length, tradeInPlayers.length);

    for (let i = 0; i < minLength; i++) {
      const outPlayer = tradeOutList[i];
      const inPlayer = tradeInPlayers[i];
      const idx = updatedTeam.findIndex(p => p.name === outPlayer.name);
      if (idx !== -1) {
        updatedTeam[idx] = inPlayer;
      } else {
        // If not found (defensive), append the new player
        updatedTeam.push(inPlayer);
      }
    }

    // If there are extra trade-ins, append them; if extra trade-outs, remove them
    if (tradeInPlayers.length > minLength) {
      for (let i = minLength; i < tradeInPlayers.length; i++) {
        updatedTeam.push(tradeInPlayers[i]);
      }
    } else if (tradeOutList.length > minLength) {
      const extraOutNames = new Set(tradeOutList.slice(minLength).map(p => p.name));
      for (let i = updatedTeam.length - 1; i >= 0; i--) {
        if (extraOutNames.has(updatedTeam[i].name)) {
          updatedTeam.splice(i, 1);
        }
      }
    }

    setTeamPlayers(updatedTeam);

    const tradeOutValue = tradeOutList.reduce((sum, p) => sum + (p.price || 0), 0);
    const tradeInCost = tradeInPlayers.reduce((sum, p) => sum + (p.price || 0), 0);
    const calculatedRemaining = (cashInBank * 1000) + tradeOutValue - tradeInCost;
    const remainingCap = typeof selectedOption.salaryRemaining === 'number'
      ? selectedOption.salaryRemaining
      : calculatedRemaining;

    setSalaryCapRemaining(remainingCap);
    setSelectedTradeOutPlayers([]);
    setSelectedTradeInIndex(null);
    setShowTradeInPage(false);
    setShowTradeModal(false);

    // Reset normal mode workflow state
    if (!isPreseasonMode) {
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
    }
    
    // Complete tour if active
    if (isTourActive && currentTourStep >= 11 && onTourComplete) {
      setTimeout(() => {
        onTourComplete();
      }, 500);
    }
  };

  // ========== PRE-SEASON MODE HANDLERS ==========

  // Handle "Highlight Options" button - highlights ALL players that satisfy trade-out rules
  // Uses the same logic as normal mode for consistency
  const handleHighlightOptions = async () => {
    if (!teamPlayers || teamPlayers.length === 0) return;
    
    setIsCalculating(true);
    setError(null);
    
    try {
      // Use the same logic as normal mode - highlight ALL problem players
      // Combine all players that have issues: injured + overvalued (urgent + regular) + not selected + junk cheapies
      const allProblemPlayers = new Set([
        ...injuredPlayers,
        ...urgentOvervaluedPlayers,
        ...overvaluedPlayers,
        ...notSelectedPlayers,
        ...junkCheapies
      ]);

      // Find the actual player objects from teamPlayers that match these names
      const highlightedPlayers = teamPlayers.filter(player =>
        allProblemPlayers.has(player.name)
      );

      // Helper to get player's urgency priority based on category and price
      // Priority hierarchy (lower number = higher urgency):
      // 1. Very overvalued (urgent overvalued) - any price
      // 2. Injured AND price > $300k
      // 3. Not selected AND price > $300k
      // 4. Overvalued AND price > $300k
      // 5. Overvalued AND price <= $300k
      // 6. Injured AND price <= $300k
      // 7. Not selected AND price <= $300k
      // 8. Junk cheapies
      const PRICE_THRESHOLD = 300000;
      const getUrgencyScore = (playerName) => {
        const player = teamPlayers.find(p => p.name === playerName);
        const price = player?.price || 0;
        const isHighValue = price > PRICE_THRESHOLD;
        
        // Check categories (in priority order)
        const isUrgentOvervalued = urgentOvervaluedPlayers.includes(playerName);
        const isInjured = injuredPlayers.includes(playerName);
        const isNotSelected = notSelectedPlayers.includes(playerName);
        const isOvervalued = overvaluedPlayers.includes(playerName);
        const isJunkCheapie = junkCheapies.includes(playerName);
        
        if (isUrgentOvervalued) return 1;
        if (isInjured && isHighValue) return 2;
        if (isNotSelected && isHighValue) return 3;
        if (isOvervalued && isHighValue) return 4;
        if (isOvervalued && !isHighValue) return 5;
        if (isInjured && !isHighValue) return 6;
        if (isNotSelected && !isHighValue) return 7;
        if (isJunkCheapie) return 8;
        return 9; // fallback
      };

      // Sort highlighted players by urgency score, then by price (higher price first within same score)
      const sortedPlayers = [...highlightedPlayers].sort((a, b) => {
        const scoreA = getUrgencyScore(a.name);
        const scoreB = getUrgencyScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        // Within same urgency, prioritize higher priced players
        return (b.price || 0) - (a.price || 0);
      });

      // Calculate priorities for the highlighted players based on urgency order
      const priorities = {};
      sortedPlayers.forEach((player, index) => {
        priorities[player.name] = index + 1;
      });

      // Set all highlighted players (not limited to 6) - selection limit is enforced elsewhere
      setPreseasonHighlightedPlayers(highlightedPlayers);
      setPreseasonPhase('selecting-out');
      setHasHighlightedPreseason(true);
      setPreseasonPriorities(priorities);
      setPreseasonHighlighted(highlightedPlayers);

      // Initialize salary cap to cash in bank only - traded-out salaries will be added as players are selected
      setPreseasonSalaryCap(cashInBank * 1000);
      
      // On mobile, close modal and go to team screen with highlights
      if (showTradeModal) {
        setShowTradeModal(false);
      }
    } catch (err) {
      console.error('Error calculating preseason trade-out recommendations:', err);
      setError(err.message || 'Failed to calculate trade-out recommendations');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle clicking on a player in preseason mode (team display)
  // Using flushSync for immediate UI updates (same fix as handleTradeOut)
  const handlePreseasonPlayerClick = (player, position) => {
    if (!player) return;

    // During selecting-out phase - user is selecting which highlighted players to trade out
    if (preseasonPhase === 'selecting-out') {
      // Check if player is highlighted (recommended for trade-out)
      const isHighlighted = preseasonHighlightedPlayers.some(p => p.name === player.name);
      if (!isHighlighted) return; // Only allow clicking highlighted players

      const exists = preseasonSelectedTradeOuts.some(p => p.name === player.name);
      if (exists) {
        // Deselect - reduce salary cap and clear position requirements
        // Use flushSync for immediate UI update
        flushSync(() => {
          setPreseasonSelectedTradeOuts(prev => prev.filter(p => p.name !== player.name));
        });
        setPositionRequirements(prev => {
          const newReqs = { ...prev };
          delete newReqs[player.name];
          return newReqs;
        });
      } else {
        // Prevent selection if already at limit (6 for preseason mode)
        if (preseasonSelectedTradeOuts.length >= 6) {
          return;
        }

        // For INT/EMG players, show position dropdown first
        if (position === 'INT' || position === 'EMG') {
          setShowPositionDropdown({ playerName: player.name, slotPosition: position });
          return;
        }

        // For positional players, add directly with automatic position requirement
        // Use flushSync for immediate UI update
        flushSync(() => {
          setPreseasonSelectedTradeOuts(prev => [...prev, {
            ...player,
            originalPosition: position,
            trade_in_positions: [position]  // Positional players require same position replacement
          }]);
        });
      }
    }
    // During selecting-in phase - user might click a traded-in player to reverse
    else if (preseasonPhase === 'selecting-in') {
      const tradedInPlayer = preseasonSelectedTradeIns.find(p => p.name === player.name);
      if (tradedInPlayer) {
        // Reverse the trade-in
        handleReversePreseasonTradeIn(tradedInPlayer);
      }
    }
  };

  // Handle confirming trade-out selections and moving to trade-in phase
  const handleConfirmPreseasonTradeOuts = async () => {
    if (preseasonSelectedTradeOuts.length === 0) return;
    
    setIsCalculating(true);
    setError(null);
    
    try {
      const { calculatePreseasonTradeIns } = await import('../services/tradeApi.js');
      
      // Check if any flexible slots (INT/EMG) are being traded out
      const hasFlexibleSlots = preseasonSelectedTradeOuts.some(p => 
        isFlexibleSlot(p.originalPosition)
      );
      
      // Get positions from selected trade-outs (only non-flexible slots)
      const nonFlexiblePositions = preseasonSelectedTradeOuts
        .filter(p => !isFlexibleSlot(p.originalPosition))
        .map(p => p.originalPosition)
        .filter(Boolean);
      
      // If there are flexible slots, don't filter by position (get all positions)
      // Otherwise, only get players matching the traded-out positions
      const tradeOutPositions = hasFlexibleSlots ? [] : nonFlexiblePositions;
      
      console.log('Trade-out slots:', preseasonSelectedTradeOuts.map(p => p.originalPosition));
      console.log('Has flexible slots:', hasFlexibleSlots);
      console.log('Position filter for API:', tradeOutPositions.length ? tradeOutPositions : 'ALL POSITIONS');
      console.log('Test approach enabled:', preseasonTestApproach);
      
      // Calculate total salary cap = cash in bank + traded-out salaries
      const totalSalaryCap = (cashInBank * 1000) + preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0);

      // If test approach is enabled, set up price bands for filtering
      if (preseasonTestApproach) {
        const bands = preseasonSelectedTradeOuts.map(p => ({
          playerName: p.name,
          originalPosition: p.originalPosition,
          price: p.price,
          minPrice: p.price - 75000,
          maxPrice: p.price + 75000,
          filled: false
        }));
        setPreseasonPriceBands(bands);
        console.log('Price bands created:', bands);
      } else {
        setPreseasonPriceBands([]);
      }

      // Calculate available trade-ins based on selected trade-outs
      const result = await calculatePreseasonTradeIns(
        teamPlayers,
        preseasonSelectedTradeOuts,
        totalSalaryCap,
        selectedStrategy,
        tradeOutPositions,
        targetByeRound,
        preseasonTestApproach // Pass test approach flag
      );
      
      setPreseasonAvailableTradeIns(result.trade_ins || []);
      setPreseasonPhase('selecting-in');
      setShowPreseasonTradeIns(true);
    } catch (err) {
      console.error('Error calculating preseason trade-ins:', err);
      setError(err.message || 'Failed to calculate trade-in options');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle selecting a trade-in player
  const handlePreseasonTradeInSelect = (player) => {
    if (!player) return;

    // Check if player is already selected
    const isAlreadySelected = preseasonSelectedTradeIns.some(p => p.name === player.name);
    if (isAlreadySelected) return;

    // Calculate total available salary = cash in bank + traded-out salaries - already selected trade-in costs
    const totalAvailableSalary = (cashInBank * 1000) +
      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

    // Check if we can afford this player
    if (player.price > totalAvailableSalary) return;
    
    // Get remaining slots that haven't been filled
    const remainingSlots = getRemainingTradeOutSlots();
    const playerPosition = player.position || player.positions?.[0];
    
    let matchingTradeOut = null;
    let matchingBandIndex = -1;

    // TEST APPROACH: Match based on price bands using backend's matching_bands data
    if (preseasonTestApproach && preseasonPriceBands.length > 0) {
      // Use the matching_bands data provided by the backend
      const playerMatchingBands = player.matching_bands || [];
      console.log('Player', player.name, 'matches bands:', playerMatchingBands.map(b => b.player_name));

      // Find an unfilled band that this player can fill, considering position compatibility
      // Match by player_name instead of index (backend indices may differ from frontend)
      for (const bandInfo of playerMatchingBands) {
        // Find the band in our frontend array by player_name
        const bandIndex = preseasonPriceBands.findIndex(b => b.playerName === bandInfo.player_name);
        if (bandIndex === -1) continue;
        
        const band = preseasonPriceBands[bandIndex];

        // Skip filled bands
        if (band.filled) continue;

        // Check if the corresponding trade-out slot is still available
        const bandSlot = remainingSlots.find(s => s.name === band.playerName);
        if (!bandSlot) continue;

        // Check position compatibility
        const isFlexible = isFlexibleSlot(bandSlot.originalPosition);
        let canFillSlot = false;
        
        // Get all positions the player can play (not just primary)
        const playerPositions = player.positions || [playerPosition];

        if (isFlexible) {
          // For flexible slots, check position requirements
          const tradeInPositions = bandSlot.trade_in_positions;
          if (!tradeInPositions || tradeInPositions.length === 0) {
            // No specific requirements, any player can fill flexible slots
            canFillSlot = true;
          } else {
            // Player must be able to play at least one of the required positions
            canFillSlot = tradeInPositions.some(requiredPos => {
              return playerPositions.includes(requiredPos);
            });
          }
        } else {
          // For non-flexible slots, check if ANY of the player's positions match
          // (e.g., Jazz Tevaga with MID/HOK can fill a HOK slot)
          canFillSlot = playerPositions.includes(bandSlot.originalPosition);
        }

        if (canFillSlot) {
          matchingTradeOut = bandSlot;
          matchingBandIndex = bandIndex;
          console.log('Using band', bandIndex, 'for player', band.playerName, '- filled by', player.name);
          break;
        }
      }

      if (!matchingTradeOut) {
        const unfilledBandNames = preseasonPriceBands.filter(b => !b.filled).map(b => b.playerName);
        console.log('Test approach: No available matching price band found for:', player.name,
          '\n  Player matches bands for:', playerMatchingBands.map(b => b.player_name),
          '\n  Unfilled bands:', unfilledBandNames,
          '\n  Remaining slots:', remainingSlots.map(s => `${s.name} (${s.originalPosition})`));
        return;
      }
    } else {
      // NORMAL APPROACH: Match based on position and requirements
      // Get all positions the player can play
      const playerPositions = player.positions || [playerPosition];
      
      // Priority 1: Find a non-flexible slot with matching position (any of player's positions)
      matchingTradeOut = remainingSlots.find(out => {
        return !isFlexibleSlot(out.originalPosition) && playerPositions.includes(out.originalPosition);
      });

      // Priority 2: If no position match, find a flexible slot where the player satisfies the position requirements
      if (!matchingTradeOut) {
        matchingTradeOut = remainingSlots.find(out => {
          if (!isFlexibleSlot(out.originalPosition)) return false;

          // Check if this flexible slot has position requirements
          const tradeInPositions = out.trade_in_positions;
          if (!tradeInPositions || tradeInPositions.length === 0) {
            // No specific requirements, any player can fill flexible slots
            return true;
          }

          // Player must be able to play at least one of the required positions
          return tradeInPositions.some(requiredPos => {
            return playerPositions.includes(requiredPos);
          });
        });
      }
    }
    
    if (!matchingTradeOut) {
      console.log('No matching slot found for:', playerPosition);
      return;
    }
    
    // Add to selected trade-ins with position info
    const tradeInWithPosition = {
      ...player,
      swappedPosition: matchingTradeOut.originalPosition, // Keep original slot for display
      swappedForPlayer: matchingTradeOut.name,
      matchedBandIndex: matchingBandIndex // Track which band this came from (test approach)
    };
    
    console.log('Trade-in selected:', player.name, '(', playerPosition, ') for slot:', matchingTradeOut.originalPosition);
    
    setPreseasonSelectedTradeIns(prev => [...prev, tradeInWithPosition]);
    
    // Mark the price band as filled (test approach)
    if (preseasonTestApproach && matchingBandIndex >= 0) {
      setPreseasonPriceBands(prev => {
        const updated = [...prev];
        updated[matchingBandIndex] = { ...updated[matchingBandIndex], filled: true };
        return updated;
      });
    }
    
    // Update team display - swap the player in
    setTeamPlayers(prev => {
      return prev.map(p => {
        if (p.name === matchingTradeOut.name) {
          return {
            ...player,
            positions: [matchingTradeOut.originalPosition], // Keep in same slot
            _preseasonSwap: true,
            _originalPlayer: matchingTradeOut
          };
        }
        return p;
      });
    });
  };

  // Handle reversing a trade-in (clicking on a swapped-in player or swap row)
  const handleReversePreseasonTradeIn = (tradedInPlayer) => {
    // Find the original player that was traded out
    const originalPlayer = preseasonSelectedTradeOuts.find(
      p => p.name === tradedInPlayer.swappedForPlayer
    );

    if (!originalPlayer) return;

    // If test approach, reset the price band to unfilled
    if (preseasonTestApproach && tradedInPlayer.matchedBandIndex >= 0) {
      setPreseasonPriceBands(prev => {
        const updated = [...prev];
        if (updated[tradedInPlayer.matchedBandIndex]) {
          updated[tradedInPlayer.matchedBandIndex] = {
            ...updated[tradedInPlayer.matchedBandIndex],
            filled: false
          };
        }
        return updated;
      });
    }

    // Remove from selected trade-ins
    setPreseasonSelectedTradeIns(prev =>
      prev.filter(p => p.name !== tradedInPlayer.name)
    );

    // Note: remaining salary is calculated dynamically, no need to update preseasonSalaryCap

    // Restore original player in team
    setTeamPlayers(prev => {
      return prev.map(p => {
        if (p.name === tradedInPlayer.name && p._preseasonSwap) {
          return originalPlayer;
        }
        return p;
      });
    });
  };

  // Handle reversing a swap by clicking on the swap row
  const handleReversePreseasonSwap = (tradeOutPlayer) => {
    // Find the corresponding trade-in player
    const tradeInPlayer = preseasonSelectedTradeIns.find(
      p => p.swappedForPlayer === tradeOutPlayer.name
    );

    if (!tradeInPlayer) return; // No swap to reverse

    // Use the existing reverse function
    handleReversePreseasonTradeIn(tradeInPlayer);
  };

  // Check if a slot is flexible (INT/EMG can accept any position)
  const isFlexibleSlot = (slotPosition) => {
    return slotPosition === 'INT' || slotPosition === 'EMG';
  };

  // Get remaining slots that need trade-ins (returns objects with slot info)
  const getRemainingTradeOutSlots = () => {
    const filledSlotNames = preseasonSelectedTradeIns.map(p => p.swappedForPlayer);
    return preseasonSelectedTradeOuts.filter(p => !filledSlotNames.includes(p.name));
  };

  // Filter available trade-ins based on remaining positions and salary
  const getFilteredTradeIns = () => {
    const remainingSlots = getRemainingTradeOutSlots();

    // Get unique positions needed (for non-flexible slots)
    const positionsNeeded = new Set();
    let hasFlexibleSlot = false;

    remainingSlots.forEach(slot => {
      if (isFlexibleSlot(slot.originalPosition)) {
        hasFlexibleSlot = true;
      } else {
        positionsNeeded.add(slot.originalPosition);
      }
    });

    // Calculate total available salary = cash in bank + traded-out salaries - already selected trade-in costs
    const totalAvailableSalary = (cashInBank * 1000) +
      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

    console.log('Remaining slots:', remainingSlots.map(s => s.originalPosition));
    console.log('Positions needed:', Array.from(positionsNeeded), 'Has flexible slot:', hasFlexibleSlot);
    console.log('Total available salary:', totalAvailableSalary);

    // TEST APPROACH: Filter by price bands using backend's matching_bands data
    if (preseasonTestApproach && preseasonPriceBands.length > 0) {
      // Get unfilled bands - use player names for matching (not indices)
      const unfilledBands = preseasonPriceBands.filter(band => !band.filled);
      const unfilledBandPlayerNames = new Set(unfilledBands.map(band => band.playerName));
      console.log('Test approach - Unfilled bands:', unfilledBands.map(b => `${b.playerName}: $${b.minPrice/1000}k-$${b.maxPrice/1000}k`));

      return preseasonAvailableTradeIns.filter(player => {
        const playerPos = player.position || player.positions?.[0];
        const notAlreadySelected = !preseasonSelectedTradeIns.some(p => p.name === player.name);
        const canAfford = player.price <= totalAvailableSalary;

        if (!notAlreadySelected || !canAfford) return false;

        // Use backend's pre-calculated matching_bands data
        const playerMatchingBands = player.matching_bands || [];

        // Check if player can fill any unfilled band with position compatibility
        // Match by player_name instead of index (backend indices may differ from frontend)
        return playerMatchingBands.some(bandInfo => {
          // Only consider unfilled bands - match by player_name
          if (!unfilledBandPlayerNames.has(bandInfo.player_name)) return false;

          // Find the band in our frontend array by player_name
          const band = preseasonPriceBands.find(b => b.playerName === bandInfo.player_name);
          if (!band) return false;

          // Check position compatibility with the band's original slot
          const bandSlot = remainingSlots.find(s => s.name === band.playerName);
          if (!bandSlot) return false;

          const isFlexible = isFlexibleSlot(bandSlot.originalPosition);
          
          // Check if ANY of the player's positions match the slot requirement
          // (not just the primary position - secondary positions count too!)
          const playerPositions = player.positions || [playerPos];
          const positionMatches = playerPositions.includes(bandSlot.originalPosition);

          // For flexible slots, also check if player matches the trade_in_positions requirements
          if (isFlexible) {
            const tradeInPositions = bandSlot.trade_in_positions;
            if (tradeInPositions && tradeInPositions.length > 0) {
              const matchesRequirement = tradeInPositions.some(requiredPos =>
                playerPositions.includes(requiredPos)
              );
              return matchesRequirement;
            }
            return true; // No specific requirements, any position can fill flexible slots
          }

          return positionMatches;
        });
      });
    }

    // NORMAL APPROACH: Filter by position
    return preseasonAvailableTradeIns.filter(player => {
      const playerPos = player.position || player.positions?.[0];
      // Position matches if:
      // 1. There's a flexible slot (INT/EMG) available, OR
      // 2. The player's position matches one of the needed positions
      const positionMatch = hasFlexibleSlot || positionsNeeded.has(playerPos);
      const canAfford = player.price <= totalAvailableSalary;
      const notAlreadySelected = !preseasonSelectedTradeIns.some(p => p.name === player.name);
      return positionMatch && canAfford && notAlreadySelected;
    });
  };

  // Render Trade Options Modal for Mobile
  const renderTradeOptionsModal = () => {
    if (!showTradeModal) return null;

    return (
      <div className="trade-modal-overlay fixed inset-0 z-50 bg-black/80 flex items-end lg:hidden" onClick={() => setShowTradeModal(false)}>
        <Card className="trade-modal-content w-full max-h-[85vh] overflow-y-auto rounded-t-2xl rounded-b-none" onClick={(e) => e.stopPropagation()}>
          <CardHeader className="sticky top-0 bg-card z-10 flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg text-primary">Trade Options</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowTradeModal(false)}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pb-8">
            {/* Trade-out selections (only in normal mode) */}
            {!isPreseasonMode && (
              <TradePanel 
                title="Trade Out"
                subtitle="Trade-out Selections"
                players={selectedTradeOutPlayers}
                onSelect={handleTradeOut}
                selectedPlayers={selectedTradeOutPlayers}
                emptyMessage="Select highlighted players to add them here"
                isTradeOut={true}
              />
            )}

            {/* Preseason mode info */}
            {isPreseasonMode && (
              <Alert className="bg-primary/10 border-primary/30">
                <AlertDescription className="text-primary">
                  Trade-out recommendations will be highlighted on your team screen
                </AlertDescription>
              </Alert>
            )}

            {/* Cash in Bank Input */}
            <div className="space-y-2">
              <label htmlFor="cashInBankModal" className="text-sm font-medium text-foreground">Cash in Bank ($)</label>
              <Input
                id="cashInBankModal"
                type="text"
                value={cashInBankDisplay}
                onChange={handleCashChange}
                placeholder="$ 000 k"
              />
            </div>

            {/* Strategy Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Strategy</label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="1">Maximize Value (Diff)</SelectItem>
                  <SelectItem value="2">Maximize Base (Projection)</SelectItem>
                  <SelectItem value="3">Hybrid Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bye round toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-foreground">Target Bye Round</label>
                <p className="text-xs text-muted-foreground">Prioritise bye coverage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetByeRound}
                  onChange={(e) => setTargetByeRound(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Pre-season Mode Toggle */}
            <Card className={cn("p-3 border", isPreseasonMode ? "border-primary bg-primary/5" : "border-primary/20")}>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Pre-season Mode</label>
                  <p className="text-xs text-muted-foreground">Up to 6 trades</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreseasonMode}
                    onChange={(e) => setIsPreseasonMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              {isPreseasonMode && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/20">
                  <div>
                    <label className="text-sm font-medium text-foreground">Test Approach</label>
                    <p className="text-xs text-muted-foreground">Price band ±$75k</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preseasonTestApproach}
                      onChange={(e) => setPreseasonTestApproach(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
            </Card>

            {/* Number of Trades (hidden in preseason mode) */}
            {!isPreseasonMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Number of Trades</label>
                <Input
                  type="number"
                  value={numTrades}
                  onChange={(e) => setNumTrades(parseInt(e.target.value) || 2)}
                  min={1}
                  max={2}
                />
              </div>
            )}

            {/* Action Button */}
            {isPreseasonMode ? (
              <Button 
                className="w-full"
                onClick={() => {
                  handleHighlightOptions();
                }}
                disabled={isCalculating}
              >
                {isCalculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isCalculating ? 'Calculating...' : 'Highlight Trade-Out Options'}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleTradeWorkflow}
                disabled={isCalculating || (normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 1)}
              >
                {isCalculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isCalculating ? 'Calculating...' :
                 normalModePhase === 'recommend' ? 'Recommend players to trade out' :
                 'Calculate trade recommendations'}
              </Button>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render Trade-In Recommendations Page for Mobile (separate page from Trade Options)
  const renderTradeInPage = () => {
    if (!showTradeInPage || isPreseasonMode) return null;

    return (
      <div className="trade-in-page fixed inset-0 z-40 bg-background flex flex-col lg:hidden">
        <div className="trade-in-page-header sticky top-0 z-10 bg-card border-b border-primary/20 p-4">
          <Button 
            variant="outline"
            onClick={() => setShowTradeInPage(false)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </div>
        
        {/* Trade-out Selections - Pinned at top */}
        <div className="trade-out-pinned shrink-0 p-4 pb-0">
          <TradePanel 
            title="Trade Out"
            subtitle="Trade-out Selections"
            players={selectedTradeOutPlayers}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage="Select highlighted players to add them here"
            isTradeOut={true}
          />
        </div>
        
        {/* Trade-in Recommendations - Scrollable */}
        <div className="trade-in-page-content flex-1 overflow-y-auto p-4">
          <TradePanel 
            title="Trade In"
            subtitle="Trade-in Recommendations"
            players={tradeInRecommendations}
            onSelect={handleTradeIn}
            selectedOptionIndex={selectedTradeInIndex}
            onConfirmOption={handleConfirmTrade}
            showConfirmButton={true}
            emptyMessage="Trade-in recommendations will appear here"
            isTradeIn={true}
          />
        </div>
      </div>
    );
  };

  // Render Pre-season Trade-In Page for Mobile
  // Handle confirming all preseason trades and returning to team view
  const handleConfirmAllPreseasonTrades = () => {
    // All swaps are already applied to teamPlayers state via handlePreseasonTradeInSelect
    // Reset preseason mode state
    setShowPreseasonTradeIns(false);
    setPreseasonPhase('idle');
    setPreseasonHighlightedPlayers([]);
    setPreseasonSelectedTradeOuts([]);
    setPreseasonSelectedTradeIns([]);
    setPreseasonAvailableTradeIns([]);
    setPreseasonSalaryCap(0);
    // Stay in preseason mode so user can make more trades if needed
  };

  const renderPreseasonTradeInPage = () => {
    if (!showPreseasonTradeIns || !isPreseasonMode) return null;

    const allPositionsFilled = preseasonSelectedTradeIns.length === preseasonSelectedTradeOuts.length;

    const remaining = (cashInBank * 1000) +
      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

    return (
      <div className="trade-in-page fixed inset-0 z-40 bg-background flex flex-col lg:hidden">
        <div className="trade-in-page-header sticky top-0 z-10 bg-card border-b border-primary/20 p-4 flex items-center gap-4">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => {
              setShowPreseasonTradeIns(false);
              setPreseasonPhase('selecting-out');
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Badge variant={remaining > 0 ? "default" : "destructive"} className="px-3 py-1">
            Cash: ${formatNumberWithCommas(Math.round(remaining / 1000))}k
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 ml-auto">
            {preseasonSelectedTradeIns.length}/{preseasonSelectedTradeOuts.length} selected
          </Badge>
        </div>
        
        {/* Trade swap rows */}
        <div className="trade-out-pinned shrink-0 p-4 pb-0">
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              {preseasonSelectedTradeOuts.map((tradeOutPlayer, index) => {
                const tradeInPlayer = preseasonSelectedTradeIns.find(
                  p => p.swappedForPlayer === tradeOutPlayer.name
                );
                const hasTradeIn = !!tradeInPlayer;
                
                return (
                  <div
                    key={tradeOutPlayer.name || index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg transition-all",
                      hasTradeIn && "cursor-pointer hover:bg-primary/10"
                    )}
                    onClick={() => hasTradeIn && handleReversePreseasonSwap(tradeOutPlayer)}
                    title={hasTradeIn ? 'Click to reverse' : ''}
                  >
                    {/* Trade Out Player */}
                    <div className={cn(
                      "flex-1 flex items-center gap-2 p-2 rounded-lg",
                      "bg-red-500/10 border border-red-500/30",
                      hasTradeIn && "opacity-50"
                    )}>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {tradeOutPlayer.originalPosition || '—'}
                      </Badge>
                      <span className="text-sm truncate flex-1">{tradeOutPlayer.name}</span>
                      <span className="text-xs text-red-400 shrink-0">
                        ${formatNumberWithCommas(Math.round(tradeOutPlayer.price / 1000))}k
                      </span>
                    </div>
                    
                    {/* Arrow */}
                    <div className={cn(
                      "text-lg px-1",
                      hasTradeIn ? "text-primary" : "text-muted-foreground"
                    )}>
                      ⇄
                    </div>
                    
                    {/* Trade In Player */}
                    <div className={cn(
                      "flex-1 flex items-center gap-2 p-2 rounded-lg",
                      hasTradeIn 
                        ? "bg-green-500/10 border border-green-500/30" 
                        : "bg-muted/50 border border-dashed border-muted-foreground/30"
                    )}>
                      {hasTradeIn ? (
                        <>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {tradeInPlayer.position || '—'}
                          </Badge>
                          <span className="text-sm truncate flex-1">{tradeInPlayer.name}</span>
                          <span className="text-xs text-green-400 shrink-0">
                            ${formatNumberWithCommas(Math.round(tradeInPlayer.price / 1000))}k
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Select trade-in...</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {allPositionsFilled && (
                <Button 
                  className="w-full mt-3"
                  onClick={handleConfirmAllPreseasonTrades}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Trades
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Trade-in options */}
        <div className="trade-in-page-content flex-1 overflow-y-auto p-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">Trade-In Options</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {getFilteredTradeIns().length > 0 ? (
                  getFilteredTradeIns().map((player, index) => {
                    const totalAvailableSalary = (cashInBank * 1000) +
                      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);
                    const isDisabled = player.price > totalAvailableSalary;
                    const isSelected = preseasonSelectedTradeIns.some(p => p.name === player.name);

                    return (
                      <div
                        key={player.name || index}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer",
                          "bg-primary/5 hover:bg-primary/10",
                          isSelected && "bg-primary/20 ring-1 ring-primary",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => !isDisabled && handlePreseasonTradeInSelect(player)}
                      >
                        <Badge variant="outline" className="px-2 py-0.5 text-xs shrink-0">
                          {player.position || player.positions?.[0] || '—'}
                        </Badge>
                        <span className="flex-1 text-sm text-foreground truncate">{player.name}</span>
                        <span className="text-xs text-primary font-semibold shrink-0">
                          ${formatNumberWithCommas(Math.round(player.price / 1000))}k
                        </span>
                        {player.diff && (
                          <span className="text-xs text-green-500 font-semibold">+{player.diff.toFixed(1)}</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    {allPositionsFilled
                      ? 'All positions filled! Click "Confirm Trades" above.'
                      : 'No trade-in options available'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Tour step configuration for team view
  // Steps 0-1 are for landing page, steps 2-9 are for team view
  const getTourStepConfig = () => {
    if (!isTourActive || currentTourStep < 2) return null;
    
    // Wait for team analysis to complete before showing tour steps
    if (!teamAnalysisComplete) return null;

    // Step 2: Highlight player cards and indicators before calculating trades
    if (currentTourStep === 2) {
      return {
        id: 'indicator-highlights',
        target: '.player-card:has(.injury-indicator), .player-card:has(.urgent-overvalued-indicator), .player-card:has(.lowupside-indicator), .player-card:has(.not-selected-indicator), .player-card:has(.junk-cheap-indicator)',
        secondaryTargets: [
          '.injury-indicator',
          '.urgent-overvalued-indicator',
          '.lowupside-indicator',
          '.not-selected-indicator',
          '.junk-cheap-indicator'
        ],
        tooltip: 'These highlighted player cards contain indicators showing players that may be candidates for trade-out. Look for injury warnings (⚠️), overvalued players (💵), and unselected players (⛔).',
        position: 'right',
        waitForAction: false,
        scrollTo: true
      };
    }

    // Step 3: Calculate trades button
    if (currentTourStep === 3) {
      return {
        id: 'calculate-trades-button',
        target: '.btn-calculate-trades, .btn-make-trade',
        tooltip: 'Now click this button to see which players the app recommends trading out based on injuries, value, and selection status.',
        position: 'top',
        waitForAction: false
      };
    }

    // Step 4: Priority numbers (after recommendations are shown)
    if (currentTourStep === 4 && hasCalculatedHighlights && normalModeHighlighted.length > 0) {
      const firstHighlighted = normalModeHighlighted[0];
      return {
        id: 'priority-numbers',
        target: firstHighlighted ? `[data-player-name="${firstHighlighted.name}"]` : '.player-card:has(.priority-indicator)',
        tooltip: 'Priority numbers (1, 2, 3...) show the recommended trade-out order. Lower numbers = higher priority.',
        position: 'right',
        waitForAction: false
      };
    }

    // Step 5: Selecting players
    if (currentTourStep === 5 && hasCalculatedHighlights && normalModeHighlighted.length > 0) {
      const firstHighlighted = normalModeHighlighted[0];
      return {
        id: 'selecting-players',
        target: firstHighlighted ? `[data-player-name="${firstHighlighted.name}"]` : '.player-card.preseason-highlight-injured, .player-card.preseason-highlight-lowupside',
        tooltip: 'Click a highlighted player card to select them for trade-out. You can select up to 2 players (or 6 in preseason mode).',
        position: 'right',
        waitForAction: false
      };
    }

    // Step 6: Calculate trade recs button (only if player selected)
    if (currentTourStep === 6 && selectedTradeOutPlayers.length > 0) {
      return {
        id: 'calculate-trade-recs-intro',
        target: '.btn-calculate-trades, .btn-make-trade',
        tooltip: 'Before proceeding, let\'s review the options that will help customize your trade recommendations. Click here when ready to explore them.',
        position: 'top',
        waitForAction: false
      };
    }

    // Step 7: Cash input field
    if (currentTourStep === 7) {
      return {
        id: 'cash-input',
        target: '.cash-input-compact, #cashInBank',
        tooltip: 'Enter your available cash here. This will be added to your salary cap for trading in players.',
        position: 'right',
        waitForAction: false,
        scrollTo: true
      };
    }

    // Step 8: Strategy dropdown
    if (currentTourStep === 8) {
      return {
        id: 'strategy-select',
        target: '.strategy-select-compact, #strategy',
        tooltip: 'Select your trading strategy: Max Value prioritizes players with high upside (projected score gains), Max Base prioritizes players with the highest scores regardless of upside.',
        position: 'right',
        waitForAction: false,
        scrollTo: true
      };
    }

    // Step 9: Bye round toggle
    if (currentTourStep === 9) {
      return {
        id: 'bye-round-toggle',
        target: '.bye-round-btn-compact',
        tooltip: 'Toggle this to prioritize players with favorable bye schedules, helping you maintain team coverage during bye rounds.',
        position: 'right',
        waitForAction: false,
        scrollTo: true
      };
    }

    // Step 10: Calculate trade recs button (after reviewing options)
    if (currentTourStep === 10 && selectedTradeOutPlayers.length > 0) {
      return {
        id: 'calculate-trade-recs',
        target: '.btn-calculate-trades, .btn-make-trade',
        tooltip: 'Now that you\'ve configured your trade preferences, click here to see trade-in recommendations that fit your salary cap and position needs.',
        position: 'top',
        waitForAction: false
      };
    }

    // Step 11: Trade-in cards (on trade-in page)
    if (currentTourStep === 11 && showTradeInPage && tradeInRecommendations.length > 0) {
      return {
        id: 'trade-in-cards',
        target: '.trade-option:first-of-type',
        secondaryTargets: [
          '.option-diff'
        ],
        tooltip: 'Trade-in recommendations appear in order of value/score (depending on your strategy). Each option covers the position requirements from your trade-outs.',
        position: 'bottom',
        waitForAction: false
      };
    }

    // Step 12: Confirm trade
    if (currentTourStep === 12 && showTradeInPage && tradeInRecommendations.length > 0) {
      return {
        id: 'confirm-trade',
        target: '.trade-option:first-of-type',
        tooltip: 'Select a trade-in option you like, then confirm to execute the trade and return to your team view.',
        position: 'top',
        waitForAction: false
      };
    }

    // Step 13: Trade-in footer/salary info
    if (currentTourStep === 13 && showTradeInPage && tradeInRecommendations.length > 0) {
      return {
        id: 'trade-in-footer',
        target: '.trade-option:first-of-type',
        tooltip: 'Review the total cost and remaining salary for each option before confirming.',
        position: 'top',
        waitForAction: false
      };
    }

    return null;
  };

  const currentStepConfig = getTourStepConfig();
  const totalTourSteps = 14; // 2 landing + 12 team view

  // Handle preseason mode tour modal
  const [showPreseasonTourModal, setShowPreseasonTourModal] = React.useState(false);
  const [hasShownPreseasonModal, setHasShownPreseasonModal] = React.useState(false);
  
  React.useEffect(() => {
    // Show preseason tour modal when preseason mode is activated during tour (on team view steps)
    if (isTourActive && isPreseasonMode && !hasShownPreseasonModal && currentTourStep >= 2) {
      setShowPreseasonTourModal(true);
      setHasShownPreseasonModal(true);
    }
  }, [isTourActive, isPreseasonMode, currentTourStep, hasShownPreseasonModal]);

  return (
    <>
      {renderTradeOptionsModal()}
      {renderTradeInPage()}
      {renderPreseasonTradeInPage()}
      
      {/* Preseason Tour Modal */}
      {showPreseasonTourModal && (
        <PreseasonTourModal
          isOpen={showPreseasonTourModal}
          onClose={() => setShowPreseasonTourModal(false)}
        />
      )}
      
      {/* Onboarding Tour */}
      {isTourActive && currentTourStep >= 2 && currentStepConfig && (
        <OnboardingTour
          isActive={isTourActive && currentStepConfig !== null}
          currentStep={currentTourStep}
          totalSteps={totalTourSteps}
          onNext={onTourNext}
          onPrevious={onTourPrevious}
          onSkip={onTourSkip}
          onComplete={onTourComplete}
          stepConfig={currentStepConfig}
        />
      )}
      
      <div className={cn("team-view flex flex-col lg:flex-row gap-4 p-2", (showTradeInPage || showPreseasonTradeIns) && "hidden lg:flex")}>
        <div className="team-view-main flex-1">
          {/* Header Section */}
          <div className="section-header mb-4 space-y-2">
            {/* Row 1: My Team heading + controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="text-xl sm:text-2xl font-bold text-primary shrink-0">MY TEAM</h2>
              
              <Input
                className="cash-input-compact w-20 sm:w-24 h-9 text-sm"
                type="text"
                value={cashInBankDisplay}
                onChange={handleCashChange}
                placeholder="$ Cash"
              />
              
              {!isPreseasonMode && (
                <div className="relative" ref={strategyDropdownRef}>
                  <Button
                    variant="outline"
                    className="strategy-select-compact w-28 sm:w-32 h-9 justify-between"
                    onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                  >
                    {selectedStrategy === '1' ? 'Max Value' : selectedStrategy === '2' ? 'Max Base' : selectedStrategy === '3' ? 'Hybrid' : 'Max Value'}
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                  {showStrategyDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-28 sm:w-32 bg-card border border-primary/30 rounded-md shadow-md z-50">
                      <div
                        className="px-3 py-2 text-sm hover:bg-primary/15 cursor-pointer"
                        onClick={() => { setSelectedStrategy('1'); setShowStrategyDropdown(false); }}
                      >
                        Max Value
                      </div>
                      <div
                        className="px-3 py-2 text-sm hover:bg-primary/15 cursor-pointer"
                        onClick={() => { setSelectedStrategy('2'); setShowStrategyDropdown(false); }}
                      >
                        Max Base
                      </div>
                      <div
                        className="px-3 py-2 text-sm hover:bg-primary/15 cursor-pointer"
                        onClick={() => { setSelectedStrategy('3'); setShowStrategyDropdown(false); }}
                      >
                        Hybrid
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <Button
                variant={targetByeRound ? "default" : "outline"}
                size="sm"
                className="bye-round-btn-compact h-9 px-3"
                onClick={() => setTargetByeRound(!targetByeRound)}
                title="Target bye round players"
              >
                Bye
              </Button>
              
              {/* Desktop Salary cap display */}
              {isPreseasonMode && preseasonPhase !== 'idle' && (
                <Badge variant={preseasonSalaryCap > 0 ? "default" : "destructive"} className="hidden lg:flex text-sm px-3 py-1 ml-auto">
                  {preseasonPhase === 'selecting-out' ? 'Cash in Bank' : 'Remaining'}: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
                </Badge>
              )}
              {!isPreseasonMode && salaryCapRemaining !== null && (
                <Badge variant="outline" className="hidden lg:flex text-sm px-3 py-1 border-primary/50 text-primary ml-auto">
                  Salary Cap: ${formatNumberWithCommas(Math.round(salaryCapRemaining / 1000))}k
                </Badge>
              )}
            </div>
            
            {/* Row 2: Action buttons */}
            <div className="header-buttons flex flex-nowrap gap-2 overflow-visible">
              <Button variant="outline" onClick={onBack} className="shrink-0 h-9" size="sm">
                ← scanner
              </Button>
              
              {/* Preseason Mode Button */}
              <Button
                variant={isPreseasonMode ? "default" : "outline"}
                onClick={() => {
                  const newState = !isPreseasonMode;
                  setIsPreseasonMode(newState);
                  if (newState) {
                    setPreseasonTestApproach(true);
                  }
                }}
                className="h-9"
                size="sm"
              >
                Pre-season
              </Button>
              
              <Button
                className="btn-make-trade flex-1 sm:flex-none h-9"
                size="sm"
                onClick={handleMakeATrade}
                disabled={(normalModePhase === 'calculate' && selectedTradeOutPlayers.length === 0) || (isPreseasonMode && hasHighlightedPreseason && preseasonSelectedTradeOuts.length === 0)}
              >
                {isPreseasonMode
                  ? (hasHighlightedPreseason ? 'Confirm trade-outs' : 'Recommend trade-outs')
                  : normalModePhase === 'calculate'
                    ? 'Calc trade recs'
                    : 'Recommend trade-outs'}
              </Button>
            </div>
          </div>

          {/* Loading screen while analyzing team */}
          {isAnalyzingTeam && !teamAnalysisComplete && (
            <div className="team-loading-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <Card className="p-8 text-center">
                <RefreshCw className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-lg font-medium text-foreground">Analyzing team...</p>
              </Card>
            </div>
          )}

          {/* Only show team once analysis is complete */}
          {teamAnalysisComplete && (
          <TeamDisplay
            players={teamPlayers}
            onTradeOut={handleTradeOut}
            selectedTradeOutPlayers={selectedTradeOutPlayers}
            selectionLimitReached={selectedTradeOutPlayers.length >= (isPreseasonMode ? 6 : numTrades)}
            isPreseasonMode={isPreseasonMode}
            preseasonHighlighted={preseasonHighlighted}
            preseasonSelectedOut={preseasonSelectedTradeOuts}
            preseasonTradedIn={preseasonSelectedTradeIns}
            preseasonPriorities={preseasonPriorities}
            onPreseasonClick={handlePreseasonPlayerClick}
            injuredPlayers={injuredPlayers}
            urgentOvervaluedPlayers={urgentOvervaluedPlayers}
            overvaluedPlayers={overvaluedPlayers}
            notSelectedPlayers={notSelectedPlayers}
            junkCheapies={junkCheapies}
            normalModeHighlighted={normalModeHighlighted}
            normalModePriorities={normalModePriorities}
            showPositionDropdown={showPositionDropdown}
            positionRequirements={positionRequirements}
            onPositionRequirementSelect={handlePositionRequirementSelect}
            onCancelPositionRequirement={handleCancelPositionRequirement}
            onPositionRequirementChange={handlePositionRequirementChange}
          />
          )}

        </div>
        
        {/* Sidebar - Desktop only */}
        <Card className="team-view-sidebar hidden lg:block w-80 shrink-0 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-primary">Trade Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cash in Bank Input */}
            <div className="space-y-2">
              <label htmlFor="cashInBank" className="text-sm font-medium text-foreground">Cash in Bank ($)</label>
              <Input
                id="cashInBank"
                type="text"
                value={cashInBankDisplay}
                onChange={handleCashChange}
                placeholder="$ 000 k"
              />
            </div>

            {/* Strategy Selection */}
            <div className="space-y-2">
              <label htmlFor="strategy" className="text-sm font-medium text-foreground">Strategy</label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="1">Maximize Value (Diff)</SelectItem>
                  <SelectItem value="2">Maximize Base (Projection)</SelectItem>
                  <SelectItem value="3">Hybrid Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bye round toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-foreground">Target Bye Round</label>
                <p className="text-xs text-muted-foreground">Prioritise bye coverage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetByeRound}
                  onChange={(e) => setTargetByeRound(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Pre-season Mode Toggle */}
            <Card className={cn("p-3 border", isPreseasonMode ? "border-primary bg-primary/5" : "border-primary/20")}>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Pre-season Mode</label>
                  <p className="text-xs text-muted-foreground">Up to 6 trades</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreseasonMode}
                    onChange={(e) => setIsPreseasonMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              {isPreseasonMode && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/20">
                  <div>
                    <label className="text-sm font-medium text-foreground">Test Approach</label>
                    <p className="text-xs text-muted-foreground">Price band ±$75k</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preseasonTestApproach}
                      onChange={(e) => setPreseasonTestApproach(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
            </Card>

            {/* Number of Trades (hidden in preseason mode) */}
            {!isPreseasonMode && (
              <div className="space-y-2">
                <label htmlFor="numTrades" className="text-sm font-medium text-foreground">Number of Trades</label>
                <Input
                  id="numTrades"
                  type="number"
                  value={numTrades}
                  onChange={(e) => setNumTrades(parseInt(e.target.value) || 2)}
                  min={1}
                  max={2}
                />
              </div>
            )}

            {/* Action Buttons based on mode */}
            {isPreseasonMode ? (
              <div className="space-y-3">
                {preseasonPhase === 'idle' && (
                  <Button 
                    className="w-full"
                    onClick={handleHighlightOptions}
                    disabled={isCalculating}
                  >
                    {isCalculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isCalculating ? 'Calculating...' : 'Highlight Trade-Out Options'}
                  </Button>
                )}
                
                {preseasonPhase === 'selecting-out' && (
                  <>
                    <Badge variant="outline" className="w-full justify-center py-2 text-primary border-primary/50">
                      Cash in Bank: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
                    </Badge>
                    <p className="text-sm text-center text-muted-foreground">
                      {preseasonSelectedTradeOuts.length} player{preseasonSelectedTradeOuts.length !== 1 ? 's' : ''} selected
                    </p>
                    <Button 
                      className="w-full"
                      onClick={handleConfirmPreseasonTradeOuts}
                      disabled={isCalculating || preseasonSelectedTradeOuts.length === 0}
                    >
                      {isCalculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isCalculating ? 'Loading Trade-Ins...' : 'Confirm Trade-Outs'}
                    </Button>
                  </>
                )}
                
                {preseasonPhase === 'selecting-in' && (
                  <>
                    {(() => {
                      const remaining = (cashInBank * 1000) +
                        preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                        preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);
                      return (
                        <>
                          <Badge variant={remaining > 0 ? "default" : "destructive"} className="w-full justify-center py-2">
                            Remaining: ${formatNumberWithCommas(Math.round(remaining / 1000))}k
                          </Badge>
                          <p className="text-sm text-center text-muted-foreground">
                            {preseasonSelectedTradeIns.length}/{preseasonSelectedTradeOuts.length} selected
                          </p>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : (
              <Button
                className="btn-calculate-trades w-full"
                onClick={handleTradeWorkflow}
                disabled={isCalculating || (normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 1)}
              >
                {isCalculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isCalculating ? 'Calculating...' :
                 normalModePhase === 'recommend' ? 'Recommend players to trade out' :
                 'Calculate trade recommendations'}
              </Button>
            )}

            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Trade Panels - Normal mode only */}
            {!isPreseasonMode && (
              <>
                <TradePanel
                  title="Trade Out"
                  subtitle="Trade-out Selections"
                  players={selectedTradeOutPlayers}
                  onSelect={handleTradeOut}
                  selectedPlayers={selectedTradeOutPlayers}
                  emptyMessage="Click on highlighted players to select them for trade-out"
                  isTradeOut={true}
                />
                
                <TradePanel 
                  title="Trade In"
                  subtitle="Trade-in Recommendations"
                  players={tradeInRecommendations}
                  onSelect={handleTradeIn}
                  selectedOptionIndex={selectedTradeInIndex}
                  onConfirmOption={handleConfirmTrade}
                  showConfirmButton={true}
                  emptyMessage="Trade-out players will generate trade-in options"
                  isTradeIn={true}
                />
              </>
            )}
            
            {/* Pre-season Trade-In List */}
            {isPreseasonMode && preseasonPhase === 'selecting-in' && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">Trade-In Options</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {getFilteredTradeIns().length > 0 ? (
                        getFilteredTradeIns().map((player, index) => {
                          const totalAvailableSalary = (cashInBank * 1000) +
                            preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                            preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);
                          const isDisabled = player.price > totalAvailableSalary;
                          const isSelected = preseasonSelectedTradeIns.some(p => p.name === player.name);

                          return (
                            <div
                              key={player.name || index}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer",
                                "bg-primary/5 hover:bg-primary/10",
                                isSelected && "bg-primary/20 ring-1 ring-primary",
                                isDisabled && "opacity-50 cursor-not-allowed"
                              )}
                              onClick={() => !isDisabled && handlePreseasonTradeInSelect(player)}
                            >
                              <Badge variant="outline" className="px-2 py-0.5 text-xs shrink-0">
                                {player.position || player.positions?.[0] || '—'}
                              </Badge>
                              <span className="flex-1 text-sm text-foreground truncate">{player.name}</span>
                              <span className="text-xs text-primary font-semibold shrink-0">
                                ${formatNumberWithCommas(Math.round(player.price / 1000))}k
                              </span>
                              {player.diff && (
                                <span className="text-xs text-green-500 font-semibold">+{player.diff.toFixed(1)}</span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground text-sm py-4">
                          {preseasonSelectedTradeIns.length === preseasonSelectedTradeOuts.length
                            ? 'All positions filled!'
                            : 'No trade-in options available'}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default TeamView;

