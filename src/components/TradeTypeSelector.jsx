import { useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X, Check } from 'lucide-react';

const POSITIONS = ['HOK', 'HLF', 'CTR', 'WFB', 'EDG', 'MID'];

function TradeTypeSelector({ 
  player, 
  slotPosition, 
  positionRequirements, 
  onPositionRequirementSelect, 
  onCancelPositionRequirement, 
  onPositionRequirementChange,
  preventClose = false // Prevent closing on outside click (used during tour)
}) {
  const panelRef = useRef(null);

  const handleConfirm = () => {
    const selectedPositions = positionRequirements[player.name] || [];
    if (selectedPositions.length > 0) {
      onPositionRequirementSelect(player, selectedPositions);
    }
  };

  const handleCancel = () => {
    if (onCancelPositionRequirement) {
      onCancelPositionRequirement(player);
    }
  };

  // Handle outside click to cancel (disabled during tour)
  useEffect(() => {
    if (preventClose) return; // Don't add outside click handler during tour
    
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [preventClose, onCancelPositionRequirement, player]);

  const isConfirmDisabled = () => {
    return !(positionRequirements[player.name] && positionRequirements[player.name].length > 0);
  };

  const selectedPositions = positionRequirements[player.name] || [];

  const handlePositionToggle = (position, checked) => {
    if (onPositionRequirementChange) {
      let newPositions;
      if (checked) {
        newPositions = [...selectedPositions, position];
      } else {
        newPositions = selectedPositions.filter(p => p !== position);
      }
      onPositionRequirementChange(player.name, newPositions);
    }
  };

  return (
    <Card 
      ref={panelRef}
      className={`trade-type-selector w-full max-w-sm shadow-lg ${preventClose ? 'border-[3px] border-[#00d9a3] shadow-[0_0_30px_rgba(0,217,163,0.6)] !bg-card' : 'border-primary/50 shadow-primary/20'}`}
    >
      <CardContent className="">
        {/* Header with label and action buttons */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-foreground">
            Select Positions for Swap:
          </Label>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              title="Cancel position selection"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={handleConfirm}
              disabled={isConfirmDisabled()}
              title="Confirm position selection"
              className="h-8 w-8"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Position checkboxes grid */}
        <div className="flex flex-col gap-2">
          {POSITIONS.map(position => (
            <div 
              key={position} 
              className="flex space-x-2"
            >
              <Checkbox
                id={`position-${position}`}
                checked={selectedPositions.includes(position)}
                onCheckedChange={(checked) => handlePositionToggle(position, checked)}
              />
              <Label 
                htmlFor={`position-${position}`}
                className="text-sm font-medium cursor-pointer text-foreground hover:text-primary transition-colors"
              >
                {position}
              </Label>
            </div>
          ))}
        </div>

        {/* Selected count indicator */}
        {selectedPositions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-xs text-muted-foreground">
              {selectedPositions.length} position{selectedPositions.length !== 1 ? 's' : ''} selected: {selectedPositions.join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TradeTypeSelector;
