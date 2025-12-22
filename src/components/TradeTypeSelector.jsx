import { useState, useRef, useEffect } from 'react';

function TradeTypeSelector({ player, slotPosition, positionRequirements, onPositionRequirementSelect, onCancelPositionRequirement, onPositionRequirementChange }) {
  const panelRef = useRef(null);

  // Handle outside click to cancel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const isConfirmDisabled = () => {
    return !(positionRequirements[player.name] && positionRequirements[player.name].length > 0);
  };

  return (
    <div className="position-selector-panel" ref={panelRef}>
      <div className="position-selection-content">
        <div className="position-selector-label-row">
          <label htmlFor="positions">Select Positions for Swap:</label>
          <div className="position-selector-buttons">
            <button
              className="btn-cancel-position-selector"
              onClick={handleCancel}
              title="Cancel position selection"
            >
              ✕
            </button>
            <button
              className="btn-confirm-position-selector"
              onClick={handleConfirm}
              disabled={isConfirmDisabled()}
              title="Confirm position selection"
            >
              ✓
            </button>
          </div>
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