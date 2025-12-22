import { useState, useRef, useEffect } from 'react';

function TradeTypeSelector({ player, slotPosition, positionRequirements, onPositionRequirementSelect, onCancelPositionRequirement, onPositionRequirementChange }) {
  const handleConfirm = () => {
    const selectedPositions = positionRequirements[player.name] || [];
    if (selectedPositions.length > 0) {
      onPositionRequirementSelect(player, selectedPositions);
    }
  };

  const isConfirmDisabled = () => {
    return !(positionRequirements[player.name] && positionRequirements[player.name].length > 0);
  };

  return (
    <div className="position-selector-panel">
      <div className="position-selection-content">
        <div className="position-selector-label-row">
          <label htmlFor="positions">Select Positions for Swap:</label>
          <button
            className="btn-confirm-position-selector"
            onClick={handleConfirm}
            disabled={isConfirmDisabled()}
            title="Confirm position selection"
          >
            ✓
          </button>
        </div>
        <select
          id="positions"
          name="positions"
          multiple
          value={positionRequirements[player.name] || []}
          onChange={(e) => {
            const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
            if (onPositionRequirementChange) {
              onPositionRequirementChange(player.name, selectedOptions);
            }
          }}
        >
          {['HOK','HLF','CTR','WFB','EDG','MID'].map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default TradeTypeSelector;