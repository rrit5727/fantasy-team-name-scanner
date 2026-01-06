import React, { useState, useEffect, useRef } from 'react';
import './OnboardingTour.css';

const OnboardingTour = ({
  isActive,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onComplete,
  stepConfig
}) => {
  const [targetElement, setTargetElement] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, adjustedPosition: 'bottom' });
  const tooltipRef = useRef(null);
  const tourOverlayRef = useRef(null);

  useEffect(() => {
    if (!isActive || !stepConfig) return;

    const selector = stepConfig.target;
    if (!selector) {
      setTargetElement(null);
      return;
    }

    // Try to find element by selector
    let element = null;
    if (typeof selector === 'string') {
      element = document.querySelector(selector);
    } else if (selector instanceof HTMLElement) {
      element = selector;
    }

    if (!element) {
      setTargetElement(null);
      return;
    }

    setTargetElement(element);

    // Add spotlight class directly to the target element
    element.classList.add('tour-spotlight');

    // Calculate tooltip position with viewport bounds checking
    const updateTooltipPosition = () => {
      const rect = element.getBoundingClientRect();
      const position = stepConfig.position || 'bottom';
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const tooltipHeight = 200; // Approximate tooltip height
      const tooltipWidth = 350; // Max tooltip width
      let top = 0;
      let left = 0;
      let adjustedPosition = position;

      if (position === 'bottom') {
        const bottomSpace = viewportHeight - rect.bottom;

        // If not enough space below, position above instead
        if (bottomSpace < tooltipHeight + 40) {
          adjustedPosition = 'top';
          top = rect.top - tooltipHeight - 20;
        } else {
          top = rect.bottom + 20;
        }
        left = Math.max(20, Math.min(
          rect.left + rect.width / 2,
          viewportWidth - tooltipWidth / 2 - 20
        ));
      } else if (position === 'top') {
        const topSpace = rect.top;

        // If not enough space above, position below instead
        if (topSpace < tooltipHeight + 40) {
          adjustedPosition = 'bottom';
          top = rect.bottom + 20;
        } else {
          top = rect.top - tooltipHeight - 20;
        }
        left = Math.max(20, Math.min(
          rect.left + rect.width / 2,
          viewportWidth - tooltipWidth / 2 - 20
        ));
      } else if (position === 'right') {
        top = Math.max(20, Math.min(
          rect.top + rect.height / 2,
          viewportHeight - tooltipHeight / 2 - 20
        ));
        left = rect.right + 20;
      } else if (position === 'left') {
        top = Math.max(20, Math.min(
          rect.top + rect.height / 2,
          viewportHeight - tooltipHeight / 2 - 20
        ));
        left = rect.left - tooltipWidth - 20;
      }

      // Ensure tooltip stays within viewport
      top = Math.max(20, Math.min(top, viewportHeight - tooltipHeight - 20));
      left = Math.max(20, Math.min(left, viewportWidth - tooltipWidth - 20));

      setTooltipPosition({ top, left, adjustedPosition });
    };

    // Initial tooltip position
    updateTooltipPosition();

    // Update tooltip on resize
    window.addEventListener('resize', updateTooltipPosition);

    // If scrollTo is true, scroll to element after a short delay to ensure it exists
    if (stepConfig.scrollTo) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    return () => {
      // Remove spotlight class from element
      element.classList.remove('tour-spotlight');
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [isActive, stepConfig, currentStep]);

  if (!isActive || !stepConfig) return null;

  const handleOverlayClick = (e) => {
    // Don't close on overlay click - require explicit skip/next
    e.stopPropagation();
  };

  const tooltipStyle = {
    top: `${tooltipPosition.top}px`,
    left: `${tooltipPosition.left}px`,
    transform: (tooltipPosition.adjustedPosition || stepConfig.position) === 'bottom' || (tooltipPosition.adjustedPosition || stepConfig.position) === 'top'
      ? 'translateX(-50%)'
      : (tooltipPosition.adjustedPosition || stepConfig.position) === 'right'
      ? 'translateY(-50%)'
      : 'translateY(-50%) translateX(-100%)'
  };

  return (
    <>
      {/* Dark overlay that covers the entire page */}
      {targetElement && (
        <div
          ref={tourOverlayRef}
          className="tour-overlay"
          onClick={handleOverlayClick}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip tour-tooltip-${tooltipPosition.adjustedPosition || stepConfig.position || 'bottom'}`}
        style={tooltipStyle}
      >
        <div className="tour-tooltip-content">
          <p className="tour-tooltip-text">{stepConfig.tooltip}</p>
          
          {/* Tour Controls */}
          <div className="tour-controls">
            <div className="tour-progress">
              Step {currentStep + 1} of {totalSteps}
            </div>
            
            <div className="tour-buttons">
              {currentStep > 0 && (
                <button 
                  className="tour-btn tour-btn-secondary"
                  onClick={onPrevious}
                >
                  Previous
                </button>
              )}
              
              {currentStep < totalSteps - 1 ? (
                <button 
                  className="tour-btn tour-btn-primary"
                  onClick={onNext}
                >
                  Next
                </button>
              ) : (
                <button 
                  className="tour-btn tour-btn-primary"
                  onClick={onComplete}
                >
                  Got it!
                </button>
              )}
              
              <button
                className="tour-btn tour-btn-link"
                onClick={onSkip}
              >
                Skip tour
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Preseason Mode Tour Carousel Component
export const PreseasonTourModal = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Preseason Mode",
      content: "Preseason mode helps you set up your team before the season starts. It's a way to correct obvious faults that you may have with your starting team."
    },
    {
      title: "More Trades Available",
      content: "Instead of the usual limit of 2 trades, preseason mode allows up to 6 players to be selected for trade-out."
    }
  ];

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleDotClick = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="preseason-tour-modal" onClick={onClose}>
      <div className="preseason-tour-carousel" onClick={(e) => e.stopPropagation()}>
        <div className="preseason-tour-slide">
          <h3>{slides[currentSlide].title}</h3>
          <p>{slides[currentSlide].content}</p>
        </div>

        <div className="preseason-tour-carousel-controls">
          <div className="preseason-tour-carousel-nav">
            {currentSlide > 0 && (
              <button 
                className="tour-btn tour-btn-secondary"
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}
            {currentSlide < slides.length - 1 && (
              <button 
                className="tour-btn tour-btn-primary"
                onClick={handleNext}
              >
                Next
              </button>
            )}
            {currentSlide === slides.length - 1 && (
              <button 
                className="tour-btn tour-btn-primary"
                onClick={onClose}
              >
                Got it!
              </button>
            )}
          </div>

          <div className="preseason-tour-dots">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`preseason-tour-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;

