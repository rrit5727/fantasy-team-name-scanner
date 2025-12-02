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
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState(null);
  const [screenshotData, setScreenshotData] = useState([]); // Store data per screenshot
  const fileInputRef = useRef(null);

  const extractPlayerNamesFromText = (text, lines) => {
    const players = [];
    
    // Multiple patterns to catch various OCR outputs
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

    // Position pattern - looks for positions after team name like "Warriors | HOK, MID | $710k"
    const positionPattern = /\|\s*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG)(?:[,\s]*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG))?\s*\|/gi;
    
    const extractFromText = (sourceText, yPosition) => {
      for (const pattern of namePatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(sourceText)) !== null) {
          let initial, surname;
          
          if (match[2]) {
            initial = (match[1] || '').toUpperCase();
            surname = match[2];
          } else if (match[1]) {
            const patternStr = pattern.toString();
            if (patternStr.includes('\\|')) {
              initial = 'I';
            } else if (patternStr.includes('1\\.')) {
              initial = 'I';
            } else if (patternStr.includes('\\)\\.')) {
              const beforeMatch = sourceText.substring(Math.max(0, match.index - 3), match.index);
              const letterMatch = beforeMatch.match(/([A-Z])\s*$/);
              initial = letterMatch ? letterMatch[1] : 'J';
            } else {
              initial = '?';
            }
            surname = match[1];
          } else {
            continue;
          }
          
          if (!surname || surname.length < 3) continue;
          
          const lowerSurname = surname.toLowerCase();
          if (['warriors', 'broncos', 'eels', 'panthers', 'bulldogs', 'titans', 
               'cowboys', 'dragons', 'raiders', 'knights', 'roosters', 'sharks',
               'rabbitohs', 'dolphins', 'mid', 'edg', 'hlf', 'hok', 'wfb', 'ctr',
               'int', 'emg', 'frf', 'score', 'rank', 'overall', 'round', 'team',
               'bench', 'starting', 'side', 'saved', 'options', 'trades', 'rankings'].includes(lowerSurname)) {
            continue;
          }
          
          const formattedSurname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
          const finalSurname = formattedSurname.replace(/-([a-z])/g, (m, c) => '-' + c.toUpperCase());
          const fullName = `${initial}. ${finalSurname}`;
          
          // Try to find position for this player - look in text after the name
          const afterName = sourceText.substring(match.index, match.index + 150);
          positionPattern.lastIndex = 0;
          const posMatch = positionPattern.exec(afterName);
          let positions = [];
          if (posMatch) {
            if (posMatch[1]) positions.push(posMatch[1].toUpperCase());
            if (posMatch[2]) positions.push(posMatch[2].toUpperCase());
          }
          
          players.push({
            name: fullName,
            positions: positions,
            y: yPosition,
            matchIndex: match.index
          });
        }
      }
    };
    
    // Process each line with bounding box for ordering
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineText = line.text || '';
        const yPos = line.bbox ? line.bbox.y0 : 0;
        extractFromText(lineText, yPos);
      }
    }
    
    // Also search the full text
    extractFromText(text || '', 0);
    
    // Sort by Y position (top to bottom)
    players.sort((a, b) => a.y - b.y || a.matchIndex - b.matchIndex);
    
    // Deduplicate while preserving order
    const seen = new Set();
    const orderedPlayers = [];
    for (const player of players) {
      if (!seen.has(player.name)) {
        seen.add(player.name);
        orderedPlayers.push({
          name: player.name,
          positions: player.positions
        });
      }
    }
    
    return orderedPlayers;
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
      
      console.log('OCR Raw Text:', result.data.text);
      setRawText(prev => prev + '\n---IMAGE ' + (imageIndex + 1) + '---\n' + result.data.text);
      
      const players = extractPlayerNamesFromText(result.data.text, result.data.lines);
      console.log('Extracted players:', players);
      
      return {
        players,
        rawText: result.data.text
      };
    } catch (err) {
      console.error('OCR Error:', err);
      throw err;
    }
  };

  const mergeAndOrderPlayers = (allScreenshotData) => {
    if (allScreenshotData.length === 0) return [];
    if (allScreenshotData.length === 1) {
      return allScreenshotData[0].players;
    }
    
    // Find which screenshot should be first (has HOK player at the top)
    let firstScreenshotIndex = 0;
    let earliestHokPosition = Infinity;
    
    for (let i = 0; i < allScreenshotData.length; i++) {
      const players = allScreenshotData[i].players;
      for (let j = 0; j < players.length; j++) {
        const hasHok = players[j].positions.includes('HOK');
        if (hasHok && j < earliestHokPosition) {
          earliestHokPosition = j;
          firstScreenshotIndex = i;
        }
      }
    }
    
    console.log(`Screenshot ${firstScreenshotIndex + 1} has HOK player earliest (position ${earliestHokPosition})`);
    
    // Reorder screenshots: first screenshot with HOK player first, then others
    const orderedScreenshots = [
      allScreenshotData[firstScreenshotIndex],
      ...allScreenshotData.filter((_, i) => i !== firstScreenshotIndex)
    ];
    
    // Merge players, removing duplicates
    const seen = new Set();
    const mergedPlayers = [];
    
    for (const screenshot of orderedScreenshots) {
      for (const player of screenshot.players) {
        if (!seen.has(player.name)) {
          seen.add(player.name);
          mergedPlayers.push(player);
        }
      }
    }
    
    return mergedPlayers;
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
      const newScreenshotData = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        const data = await processImage(imageFiles[i], i, imageFiles.length);
        newScreenshotData.push(data);
      }

      // Merge with existing screenshot data
      setScreenshotData(prev => {
        const allData = [...prev, ...newScreenshotData];
        const mergedPlayers = mergeAndOrderPlayers(allData);
        
        console.log('Final merged players:', mergedPlayers);
        setExtractedPlayers(mergedPlayers);
        
        if (onPlayersExtracted) {
          onPlayersExtracted(mergedPlayers);
        }
        
        return allData;
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

    // CSV with position
    const header = 'Position,Player Name';
    const rows = extractedPlayers.map(p => {
      const pos = p.positions && p.positions.length > 0 ? p.positions[0] : 'TBD';
      return `${pos},${p.name}`;
    });
    const content = [header, ...rows].join('\n');
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'player-names.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    previewImages.forEach(img => URL.revokeObjectURL(img.url));
    setPreviewImages([]);
    setExtractedPlayers([]);
    setScreenshotData([]);
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
          <span>Upload your team screenshots (any order)</span>
        </div>
        <div className="instruction-step">
          <span className="step-number">2</span>
          <span>App auto-detects correct order via HOK position</span>
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
                Download CSV
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
                <span className="player-position">
                  {player.positions && player.positions.length > 0 
                    ? player.positions.join(', ') 
                    : '—'}
                </span>
                <span className="player-name">{player.name}</span>
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
