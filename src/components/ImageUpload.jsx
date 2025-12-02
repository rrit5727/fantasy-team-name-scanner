import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import './ImageUpload.css';

function ImageUpload({ onPlayersExtracted }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [previewImages, setPreviewImages] = useState([]);
  const [extractedPlayers, setExtractedPlayers] = useState([]);
  const [rawText, setRawText] = useState(''); // For debugging
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const extractPlayerNamesFromText = (text, lines) => {
    const players = [];
    
    // Multiple patterns to catch various OCR outputs
    // OCR often misreads: J. → J). or J)   and   I. → |.
    const namePatterns = [
      // Standard: "E. Clark", "A. Fonua-Blake" 
      /([A-Z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // No space: "E.Clark"
      /([A-Z])\.([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // OCR reads period as ): "J). Williams" or "J).Williams"
      /([A-Z])\)\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // OCR reads just ) instead of .: "J) Williams"
      /([A-Z])\)\s+([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // OCR misses the letter, just has ).: "). Ford" or ").Ford"
      /\)\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // OCR reads I as | (pipe): "|. Katoa"
      /\|\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // OCR reads I as 1: "1. Katoa"
      /1\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // Lowercase initial: "j. Williams"
      /([a-z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      // With special chars before: "@ E. Clark"
      /[^A-Za-z]([A-Z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
    ];
    
    const extractFromText = (sourceText, yPosition) => {
      for (const pattern of namePatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(sourceText)) !== null) {
          let initial, surname;
          
          // Handle patterns with different capture groups
          if (match[2]) {
            // Pattern has initial in group 1, surname in group 2
            initial = (match[1] || '').toUpperCase();
            surname = match[2];
          } else if (match[1]) {
            // Pattern only has surname (like |. or 1. patterns)
            // Try to infer the initial from context
            const patternStr = pattern.toString();
            if (patternStr.includes('\\|')) {
              initial = 'I'; // Pipe was meant to be I
            } else if (patternStr.includes('1\\.')) {
              initial = 'I'; // 1 was meant to be I
            } else if (patternStr.includes('\\)\\.')) {
              // ). pattern - initial might be missing, try to get from before
              const beforeMatch = sourceText.substring(Math.max(0, match.index - 3), match.index);
              const letterMatch = beforeMatch.match(/([A-Z])\s*$/);
              initial = letterMatch ? letterMatch[1] : 'J'; // Default to J as common
            } else {
              initial = '?';
            }
            surname = match[1];
          } else {
            continue;
          }
          
          if (!surname || surname.length < 3) continue;
          
          // Skip common false positives (team names, position codes)
          const lowerSurname = surname.toLowerCase();
          if (['warriors', 'broncos', 'eels', 'panthers', 'bulldogs', 'titans', 
               'cowboys', 'dragons', 'raiders', 'knights', 'roosters', 'sharks',
               'rabbitohs', 'dolphins', 'mid', 'edg', 'hlf', 'hok', 'wfb', 'ctr',
               'int', 'emg', 'frf', 'score', 'rank', 'overall', 'round', 'team',
               'bench', 'starting', 'side', 'saved', 'options', 'trades', 'rankings'].includes(lowerSurname)) {
            continue;
          }
          
          // Format properly
          const formattedSurname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
          // Handle hyphenated names like "Fonua-Blake" or "King-Togia"
          const finalSurname = formattedSurname.replace(/-([a-z])/g, (m, c) => '-' + c.toUpperCase());
          const fullName = `${initial}. ${finalSurname}`;
          
          players.push({
            name: fullName,
            y: yPosition
          });
        }
      }
    };
    
    // First: process each line with its bounding box for ordering
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineText = line.text || '';
        const yPos = line.bbox ? line.bbox.y0 : 0;
        extractFromText(lineText, yPos);
      }
    }
    
    // Also search the full text to catch anything missed
    const fullText = text || '';
    extractFromText(fullText, 0); // Will be re-sorted anyway
    
    // Sort by Y position (top to bottom)
    players.sort((a, b) => a.y - b.y);
    
    // Deduplicate while preserving order
    const seen = new Set();
    const orderedNames = [];
    for (const player of players) {
      if (!seen.has(player.name)) {
        seen.add(player.name);
        orderedNames.push(player.name);
      }
    }
    
    return orderedNames;
  };

  const processImage = async (file, imageIndex, total) => {
    try {
      setCurrentImage(imageIndex + 1);
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const imageProgress = m.progress;
            const overallProgress = ((imageIndex + imageProgress) / total) * 100;
            setProgress(Math.round(overallProgress));
          }
        },
      });
      
      // Store raw text for debugging
      console.log('OCR Raw Text:', result.data.text);
      console.log('OCR Lines:', result.data.lines);
      setRawText(prev => prev + '\n---IMAGE ' + (imageIndex + 1) + '---\n' + result.data.text);
      
      // Extract player names
      const names = extractPlayerNamesFromText(result.data.text, result.data.lines);
      console.log('Extracted names:', names);
      
      return names;
    } catch (err) {
      console.error('OCR Error:', err);
      throw err;
    }
  };

  const handleFiles = useCallback(async (files) => {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      setError('Please upload image files only');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setTotalImages(imageFiles.length);
    setCurrentImage(0);

    const previews = imageFiles.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setPreviewImages(prev => [...prev, ...previews]);

    try {
      const allPlayers = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        const players = await processImage(imageFiles[i], i, imageFiles.length);
        allPlayers.push(...players);
      }

      console.log('All players found:', allPlayers);

      // Add to existing players, maintaining order and removing duplicates
      setExtractedPlayers(prev => {
        const combined = [...prev, ...allPlayers];
        const seen = new Set();
        const unique = [];
        for (const name of combined) {
          if (!seen.has(name)) {
            seen.add(name);
            unique.push(name);
          }
        }
        
        if (onPlayersExtracted) {
          onPlayersExtracted(unique);
        }
        
        return unique;
      });
      
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process images. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentImage(0);
    }
  }, [onPlayersExtracted]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [handleFiles]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  };

  const downloadPlayers = () => {
    if (extractedPlayers.length === 0) return;

    const content = extractedPlayers.join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'player-names.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    previewImages.forEach(img => URL.revokeObjectURL(img.url));
    setPreviewImages([]);
    setExtractedPlayers([]);
    setRawText('');
    setError(null);
  };

  const removePlayer = (index) => {
    setExtractedPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const movePlayer = (index, direction) => {
    setExtractedPlayers(prev => {
      const newList = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newList.length) return prev;
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      return newList;
    });
  };

  return (
    <div className="image-upload-container">
      <div className="upload-instructions">
        <div className="instruction-step">
          <span className="step-number">1</span>
          <span>Upload your first team screenshot</span>
        </div>
        <div className="instruction-step">
          <span className="step-number">2</span>
          <span>Upload second screenshot to get remaining players</span>
        </div>
        <div className="instruction-step">
          <span className="step-number">3</span>
          <span>Download your ordered player list</span>
        </div>
      </div>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="file-input"
        />
        
        {isProcessing ? (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <p>Scanning image {currentImage} of {totalImages}...</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-text">{progress}%</span>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">📸</div>
            <p className="upload-text">
              {previewImages.length === 0 
                ? 'Tap to upload screenshots' 
                : 'Tap to add more screenshots'}
            </p>
            <p className="upload-hint">
              {previewImages.length === 0 
                ? 'Upload 2 screenshots to capture your full team'
                : `${previewImages.length} screenshot${previewImages.length > 1 ? 's' : ''} uploaded`}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {previewImages.length > 0 && (
        <div className="preview-section">
          <h3>Uploaded Screenshots ({previewImages.length})</h3>
          <div className="preview-grid">
            {previewImages.map((img, index) => (
              <div key={index} className="preview-item">
                <img src={img.url} alt={`Screenshot ${index + 1}`} />
                <span className="preview-label">#{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug: Show raw OCR text */}
      {rawText && (
        <div className="debug-section">
          <details>
            <summary className="debug-toggle">
              🔍 Show OCR Output (Debug)
            </summary>
            <p className="debug-hint">Raw text from OCR - check console for detailed logs</p>
            <pre className="debug-text">{rawText}</pre>
          </details>
        </div>
      )}

      {extractedPlayers.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Players ({extractedPlayers.length})</h3>
            <div className="results-actions">
              <button onClick={downloadPlayers} className="btn-download">
                Download List
              </button>
              <button onClick={clearAll} className="btn-clear">
                Clear All
              </button>
            </div>
          </div>
          
          <ul className="player-list">
            {extractedPlayers.map((player, index) => (
              <li key={index} className="player-item">
                <span className="player-number">{index + 1}</span>
                <span className="player-name">{player}</span>
                <div className="player-actions">
                  <button 
                    className="btn-move"
                    onClick={() => movePlayer(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button 
                    className="btn-move"
                    onClick={() => movePlayer(index, 1)}
                    disabled={index === extractedPlayers.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button 
                    className="btn-remove"
                    onClick={() => removePlayer(index)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
          
          <p className="edit-hint">💡 Use arrows to reorder, ✕ to remove incorrect entries</p>
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
