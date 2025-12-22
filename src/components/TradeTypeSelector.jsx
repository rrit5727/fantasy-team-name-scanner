import { useState, useRef, useEffect } from 'react';

function TradeTypeSelector({ playerName, slotPosition, positionRequirements, onPositionRequirementSelect, onCancelPositionRequirement, onPositionRequirementChange }) {
  const handleConfirm = () => {
    const selectedPositions = positionRequirements[playerName] || [];
    if (selectedPositions.length > 0) {
      onPositionRequirementSelect({ name: playerName }, selectedPositions);
    }
  };

  const isConfirmDisabled = () => {
    return !(positionRequirements[playerName] && positionRequirements[playerName].length > 0);
  };

  return (
    <div className="position-selector-panel">
      <div className="position-selector-header">
        <h3>Select Positions</h3>
        <p>For {playerName} ({slotPosition})</p>
        <button
          className="btn-close-position-selector"
          onClick={handleConfirm}
          disabled={isConfirmDisabled()}
          title="Confirm position selection"
        >
          ✓
        </button>
      </div>

      <div className="position-selection-content">
        <label htmlFor="positions">Select Positions for Swap:</label>
        <select
          id="positions"
          name="positions"
          multiple
          value={positionRequirements[playerName] || []}
          onChange={(e) => {
            const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
            if (onPositionRequirementChange) {
              onPositionRequirementChange(playerName, selectedOptions);
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