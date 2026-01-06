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
  const [overlayParts, setOverlayParts] = useState({ top: null, bottom: null, left: null, right: null });
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

    // Calculate overlay parts that surround the target element
    const updateOverlayParts = () => {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      setOverlayParts({
        top: {
          left: 0,
          top: 0,
          width: viewportWidth,
          height: rect.top
        },
        bottom: {
          left: 0,
          top: rect.bottom,
          width: viewportWidth,
          height: viewportHeight - rect.bottom
        },
        left: {
          left: 0,
          top: rect.top,
          width: rect.left,
          height: rect.height
        },
        right: {
          left: rect.right,
          top: rect.top,
          width: viewportWidth - rect.right,
          height: rect.height
        }
      });
    };

    // Initial overlay calculation
    updateOverlayParts();

    // Calculate tooltip position based on step
    const updateTooltipPosition = () => {
      const rect = element.getBoundingClientRect();
      const position = stepConfig.position || 'bottom';
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const tooltipHeight = 250; // Approximate tooltip height
      const tooltipWidth = 350; // Max tooltip width
      const gap = 30; // Minimum gap between tooltip and element
      let top = 0;
      let left = 0;
      let adjustedPosition = position;

      // Steps 0-1: Position relative to element (original behavior)
      if (currentStep <= 1) {
        if (position === 'bottom') {
          const bottomSpace = viewportHeight - rect.bottom;

          // If not enough space below, position above instead
          if (bottomSpace < tooltipHeight + gap + 20) {
            adjustedPosition = 'top';
            top = rect.top - tooltipHeight - gap;
          } else {
            top = rect.bottom + gap;
          }
          // Center horizontally on element, but keep within viewport
          left = rect.left + rect.width / 2;
        } else if (position === 'top') {
          const topSpace = rect.top;

          // If not enough space above, position below instead
          if (topSpace < tooltipHeight + gap + 20) {
            adjustedPosition = 'bottom';
            top = rect.bottom + gap;
          } else {
            top = rect.top - tooltipHeight - gap;
          }
          // Center horizontally on element, but keep within viewport
          left = rect.left + rect.width / 2;
        } else if (position === 'right') {
          const rightSpace = viewportWidth - rect.right;

          // If not enough space on right, try left
          if (rightSpace < tooltipWidth + gap + 20) {
            adjustedPosition = 'left';
            left = rect.left - tooltipWidth - gap;
          } else {
            left = rect.right + gap;
          }
          // Center vertically on element
          top = rect.top + rect.height / 2;
        } else if (position === 'left') {
          const leftSpace = rect.left;

          // If not enough space on left, try right
          if (leftSpace < tooltipWidth + gap + 20) {
            adjustedPosition = 'right';
            left = rect.right + gap;
          } else {
            left = rect.left - tooltipWidth - gap;
          }
          // Center vertically on element
          top = rect.top + rect.height / 2;
        }

        // Ensure tooltip stays within viewport with padding
        top = Math.max(20, Math.min(top, viewportHeight - tooltipHeight - 20));

        // For horizontal positioning, keep tooltip within bounds
        if (adjustedPosition === 'bottom' || adjustedPosition === 'top') {
          // Ensure centered tooltip doesn't go off screen
          const minLeft = 20 + tooltipWidth / 2;
          const maxLeft = viewportWidth - tooltipWidth / 2 - 20;
          left = Math.max(minLeft, Math.min(left, maxLeft));
        } else {
          // For left/right positioning
          left = Math.max(20, Math.min(left, viewportWidth - tooltipWidth - 20));
        }
      }
      // Steps 2-6: Pin to bottom of viewport
      else if (currentStep >= 2 && currentStep <= 6) {
        adjustedPosition = 'bottom-fixed';
        top = viewportHeight; // Will use bottom positioning in CSS
        left = viewportWidth / 2;
      }
      // Steps 7-8: Pin to top of viewport
      else if (currentStep >= 7 && currentStep <= 8) {
        adjustedPosition = 'top-fixed';
        top = 0; // Will use top positioning in CSS
        left = viewportWidth / 2;
      }

      setTooltipPosition({ top, left, adjustedPosition });
    };

    // Initial tooltip position
    updateTooltipPosition();

    // Update overlay parts and tooltip on resize and scroll
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('resize', updateOverlayParts);
    window.addEventListener('scroll', updateOverlayParts);
    window.addEventListener('scroll', updateTooltipPosition);

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
      window.removeEventListener('resize', updateOverlayParts);
      window.removeEventListener('scroll', updateOverlayParts);
      window.removeEventListener('scroll', updateTooltipPosition);
    };
  }, [isActive, stepConfig, currentStep]);

  if (!isActive || !stepConfig) return null;

  const handleOverlayClick = (e) => {
    // Don't close on overlay click - require explicit skip/next
    e.stopPropagation();
  };

  const tooltipStyle = {
    bottom: tooltipPosition.adjustedPosition === 'bottom-fixed' ? '20px' : 'auto',
    top: tooltipPosition.adjustedPosition === 'top-fixed' ? '20px' : tooltipPosition.adjustedPosition === 'bottom-fixed' ? 'auto' : `${tooltipPosition.top}px`,
    left: (tooltipPosition.adjustedPosition === 'bottom-fixed' || tooltipPosition.adjustedPosition === 'top-fixed') ? '50%' : `${tooltipPosition.left}px`,
    transform: (tooltipPosition.adjustedPosition === 'bottom-fixed' || tooltipPosition.adjustedPosition === 'top-fixed')
      ? 'translateX(-50%)'
      : (tooltipPosition.adjustedPosition || stepConfig.position) === 'bottom' || (tooltipPosition.adjustedPosition || stepConfig.position) === 'top'
      ? 'translateX(-50%)'
      : (tooltipPosition.adjustedPosition || stepConfig.position) === 'right'
      ? 'translateY(-50%)'
      : 'translateY(-50%) translateX(-100%)'
  };

  return (
    <>
      {/* Four-part overlay that surrounds the target element */}
      {targetElement && overlayParts.top && (
        <>
          <div
            className="tour-overlay-part"
            style={{
              position: 'fixed',
              left: `${overlayParts.top.left}px`,
              top: `${overlayParts.top.top}px`,
              width: `${overlayParts.top.width}px`,
              height: `${overlayParts.top.height}px`,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9998,
              pointerEvents: 'auto'
            }}
            onClick={handleOverlayClick}
          />
          <div
            className="tour-overlay-part"
            style={{
              position: 'fixed',
              left: `${overlayParts.bottom.left}px`,
              top: `${overlayParts.bottom.top}px`,
              width: `${overlayParts.bottom.width}px`,
              height: `${overlayParts.bottom.height}px`,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9998,
              pointerEvents: 'auto'
            }}
            onClick={handleOverlayClick}
          />
          <div
            className="tour-overlay-part"
            style={{
              position: 'fixed',
              left: `${overlayParts.left.left}px`,
              top: `${overlayParts.left.top}px`,
              width: `${overlayParts.left.width}px`,
              height: `${overlayParts.left.height}px`,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9998,
              pointerEvents: 'auto'
            }}
            onClick={handleOverlayClick}
          />
          <div
            className="tour-overlay-part"
            style={{
              position: 'fixed',
              left: `${overlayParts.right.left}px`,
              top: `${overlayParts.right.top}px`,
              width: `${overlayParts.right.width}px`,
              height: `${overlayParts.right.height}px`,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9998,
              pointerEvents: 'auto'
            }}
            onClick={handleOverlayClick}
          />
        </>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip tour-tooltip-${tooltipPosition.adjustedPosition || stepConfig.position || 'bottom'}`}
        style={(tooltipPosition.adjustedPosition === 'bottom-fixed' || tooltipPosition.adjustedPosition === 'top-fixed') ? {} : tooltipStyle}
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
                  Prev
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
                Skip
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

