import { useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X, Check } from 'lucide-react';

const POSITIONS = ['HOK', 'HLF', 'CTR', 'WFB', 'EDG', 'MID', 'ALL'];

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
    let positions = positionRequirements[player.name] || [];
    // If 'ALL' is selected, expand it to all individual positions
    if (positions.includes('ALL')) {
      positions = POSITIONS.filter(p => p !== 'ALL');
    }
    if (positions.length > 0) {
      onPositionRequirementSelect(player, positions);
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
      if (position === 'ALL') {
        // If 'ALL' is toggled, store 'ALL' or clear the array.
        newPositions = checked ? ['ALL'] : [];
      } else {
        // When an individual position is toggled:
        // If 'ALL' was previously selected, clicking an individual position should deselect 'ALL'
        // and manage individual positions.
        let currentSelected = selectedPositions.includes('ALL')
          ? POSITIONS.filter(p => p !== 'ALL') // Treat as if all were individually selected
          : [...selectedPositions]; // Use existing individual selections

        if (checked) {
          newPositions = [...currentSelected, position];
        } else {
          newPositions = currentSelected.filter(p => p !== position);
        }
      }
      onPositionRequirementChange(player.name, newPositions);
    }
  };

  return (
    <Card 
      ref={panelRef}
      className={`trade-type-selector w-full max-w-sm min-h-[170px] shadow-lg ${preventClose ? 'border-[3px] border-[#00d9a3] shadow-[0_0_30px_rgba(0,217,163,0.6)] !bg-card' : 'border-primary/50 shadow-primary/20'}`}
    >
      <CardContent className="px-4">
        {/* Header with label and action buttons */}
        <div className="flex items-center justify-around mx-auto pt-2 pb-1">
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
        <div className="grid grid-cols-2 gap-y-1 items-center justify-items-center">
          <div key="ALL" className="flex space-x-2 w-24">
            <Checkbox
              id="position-ALL"
              checked={selectedPositions.includes('ALL')}
              onCheckedChange={(checked) => handlePositionToggle('ALL', checked)}
            />
            <Label
              htmlFor="position-ALL"
              className="text-sm font-medium cursor-pointer text-foreground hover:text-primary transition-colors"
            >
              All
            </Label>
          </div>
          <div></div> {/* Empty div for the second column of the first row */}
          {POSITIONS.filter(p => p !== 'ALL').reduce((acc, position, index) => {
            const item = (
              <div
                key={position}
                className="flex space-x-2 w-24"
              >
                <Checkbox
                  id={`position-${position}`}
                  checked={selectedPositions.includes(position) || (selectedPositions.includes('ALL') && position !== 'ALL')}
                  onCheckedChange={(checked) => handlePositionToggle(position, checked)}
                  disabled={selectedPositions.includes('ALL')}
                />
                <Label
                  htmlFor={`position-${position}`}
                  className={`text-sm font-medium cursor-pointer text-foreground hover:text-primary transition-colors ${selectedPositions.includes('ALL') ? 'opacity-50' : ''}`}
                >
                  {position}
                </Label>
              </div>
            );
            acc.push(item);
            return acc;
          }, [])}
        </div>

      </CardContent>
    </Card>
  );
}

export default TradeTypeSelector;
