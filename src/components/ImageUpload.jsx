  import { useState, useRef, useCallback } from 'react';
  import Tesseract from 'tesseract.js';
  import { lookupPlayerPrices } from '../services/tradeApi';
  import OnboardingTour from './OnboardingTour';
  import './ImageUpload.css';
  import screenshotBench from '../assets/screenshot-bench.jpg';
  import screenshotTeam from '../assets/screenshot-team.jpg';

  function ImageUpload({ 
    onPlayersExtracted,
    isTourActive = false,
    currentTourStep = 0,
    onTourNext,
    onTourPrevious,
    onTourSkip,
    onTourComplete
  }) {
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

    // Detect which screenshot format is being used
    const detectScreenshotFormat = (rawText) => {
      // Format 1: Has position patterns like "| HOK |" or prices like "$710k"
      const hasPositionMarkers = /\|\s*(HOK|MID|EDG|HLF|CTR|WFB)\s*\|/i.test(rawText);
      const hasPriceMarkers = /\$\s*\d{2,3}[|lIO0o]?\d{1,2}k/i.test(rawText);
      
      if (hasPositionMarkers || hasPriceMarkers) {
        console.log('Detected Format 1 (positions/prices visible)');
        return 'format1';
      }
      
      // Format 2: Has © symbols (from checkmarks) or BENCH marker without position/price data
      const hasCheckmarks = /©/.test(rawText);
      const hasBenchMarker = /BENCH\s*\(\d+\/\d+\)/i.test(rawText);
      
      if (hasCheckmarks || hasBenchMarker) {
        console.log('Detected Format 2 (checkmark icons, no positions/prices)');
        return 'format2';
      }
      
      console.log('Unknown format, defaulting to format1 logic');
      return 'unknown';
    };

    // Assign positions to players based on Y-position ordering (for Format 2)
    const assignFormat2Positions = (players) => {
      // Sort by Y position (top to bottom), then by matchIndex for same Y
      const sorted = [...players].sort((a, b) => a.y - b.y || a.matchIndex - b.matchIndex);
      
      // Expected structure: HOK(1), MID(3), EDG(2), HLF(2), CTR(2), WFB(3), INT(4), EMG(4) = 21 total
      const positionMap = [
        { pos: 'HOK', count: 1 },
        { pos: 'MID', count: 3 },
        { pos: 'EDG', count: 2 },
        { pos: 'HLF', count: 2 },
        { pos: 'CTR', count: 2 },
        { pos: 'WFB', count: 3 },
        { pos: 'INT', count: 4 },
        { pos: 'EMG', count: 4 },
      ];
      
      let playerIndex = 0;
      for (const { pos, count } of positionMap) {
        for (let i = 0; i < count && playerIndex < sorted.length; i++) {
          sorted[playerIndex].positions = [pos];
          playerIndex++;
        }
      }
      
      console.log('Format 2: Assigned positions based on Y-order:', sorted.map(p => `${p.name}: ${p.positions[0]}`));
      return sorted;
    };

    const extractPlayerNamesFromText = (text, lines) => {
      const players = [];
      
      // Multiple patterns to catch various OCR outputs
      const namePatterns = [
        // Standard: "E. Clark", "A. Fonua-Blake" 
        /([A-Z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // No space: "E.Clark" or "P.Haas"
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
        
        // === FORMAT 2 PATTERNS (checkmark icons, no positions/prices) ===
        // © P.Haas or © P. Haas (checkmark symbol before name)
        /©\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // + J Campbell or + J. Campbell (plus symbol before name)
        /\+\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // & S. Drinkwater or & S Drinkwater (ampersand before name with initial)
        // Note: We require an initial to avoid false matches like "Campbell & Drinkwater" -> "L. Drinkwater"
        /&\s+([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // * R Smith or * R. Smith (asterisk before name)
        /\*\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // L Metcalf (single letter space surname - OCR missed the period)
        /(?:^|[^A-Za-z])([A-Z])\s+([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)(?=[^a-z]|$)/g,
        // Handle names with « or » (OCR artifacts)
        /[«»]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // Handle names with bullet points or similar markers
        /[•●○]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        
        // === MORE AGGRESSIVE PATTERNS FOR OCR RECOVERY ===
        // Names with OCR artifacts before them (numbers, special chars)
        /[\d<>]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // K. or K followed by surname (handle K. Donoghoe type names)
        /([KkDdTtBbVv])[\.\s]+([A-Z][a-zA-Z]{3,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // OCR misreads © as O - "OR Cotter" should be "R. Cotter", "OT Tatola" should be "T. Tatola"
        /O([A-Z])[\.\s]*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // OCR misreads © as Q - "Qs. Hughes" should be "S. Hughes"
        /Q([a-z])[\.\s]*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // OCR misreads © as @ - "@ B.Smith" or "@B. Smith"
        /@\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
        // OCR misreads © as ® - "® S.Kris"
        /®\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      ];

      // Position pattern - looks for positions after team name like "Warriors | HOK, MID | $710k"
      const positionPattern = /\|\s*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG)(?:[,\s]*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG))?\s*\|/gi;
      
      // Price pattern - looks for prices like "$710k", "$609k", handles OCR errors like "$7|0k", "$71Ok"
      const pricePattern = /\$\s*(\d{2,3})[|lIO0o]?(\d{1,2})k/gi;
      
      const extractFromText = (sourceText, yPosition) => {
        for (const pattern of namePatterns) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(sourceText)) !== null) {
            let initial, surname;
            
            if (match[2]) {
              initial = (match[1] || '').toUpperCase();
              surname = match[2];
              
              // If initial is empty (e.g., "& Drinkwater" without initial), skip the entry
              // It's likely a duplicate of an entry with a proper initial
              if (!initial || initial.length === 0) {
                continue;
              }
            } else if (match[1]) {
              const patternStr = pattern.toString();
              if (patternStr.includes('\\|')) {
                initial = 'I';
                surname = match[1];
              } else if (patternStr.includes('1\\.')) {
                initial = 'I';
                surname = match[1];
              } else if (patternStr.includes('\\)\\.')) {
                const beforeMatch = sourceText.substring(Math.max(0, match.index - 3), match.index);
                const letterMatch = beforeMatch.match(/([A-Z])\s*$/);
                initial = letterMatch ? letterMatch[1] : 'J';
                surname = match[1];
              } else {
                initial = '?';
                surname = match[1];
              }
            } else {
              continue;
            }
            
            if (!surname || surname.length < 3) continue;
            
            const lowerSurname = surname.toLowerCase();
            // Exclude team names, positions, and UI text
            if (['warriors', 'broncos', 'eels', 'panthers', 'bulldogs', 'titans', 
                'cowboys', 'dragons', 'raiders', 'knights', 'roosters', 'sharks',
                'rabbitohs', 'dolphins', 'mid', 'edg', 'hlf', 'hok', 'wfb', 'ctr',
                'int', 'emg', 'frf', 'score', 'rank', 'overall', 'round', 'team',
                'bench', 'starting', 'side', 'saved', 'options', 'trades', 'rankings',
                // Additional Format 2 UI text exclusions
                'download', 'clear', 'csv', 'players', 'uploaded', 'screenshots',
                'image', 'upload', 'confirm', 'remove', 'move', 'back', 'scanner',
                'tap', 'capture', 'full', 'hisense', 'dnp', 'captain',
                // False positives from OCR misreading UI elements
                'tions', 'ptions', 'omplete', 'complete', 'aved', 'swyftx'].includes(lowerSurname)) {
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
            
            // Try to find price for this player - look in text after the name
            pricePattern.lastIndex = 0;
            const priceMatch = pricePattern.exec(afterName);
            let price = null;
            if (priceMatch) {
              // Extract price components and handle OCR errors
              const hundreds = priceMatch[1]; // e.g., "71", "60", "85"
              const tens = priceMatch[2]; // e.g., "0", "9", "0"
              // Convert "$710k" to 710000
              price = parseInt(hundreds + tens) * 1000;
            }
            
            players.push({
              name: fullName,
              positions: positions,
              price: price,
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
      
      // Deduplicate while preserving order and preferring entries with price data
      // Also deduplicate by surname to handle cases like ". Drinkwater" vs "S. Drinkwater"
      const seen = new Map();
      const seenBySurname = new Map(); // Track by surname for better deduplication
      
      for (const player of players) {
        // Extract surname for duplicate detection
        const nameParts = player.name.split('. ');
        const surname = nameParts.length > 1 ? nameParts[1].toLowerCase() : player.name.toLowerCase();
        const initial = nameParts.length > 1 ? nameParts[0] : '';
        const hasValidInitial = initial.length === 1 && /[A-Z]/i.test(initial);
        
        if (!seen.has(player.name)) {
          // Check if we already have this player by surname with a different/invalid initial
          if (seenBySurname.has(surname)) {
            const existing = seenBySurname.get(surname);
            const existingParts = existing.name.split('. ');
            const existingInitial = existingParts.length > 1 ? existingParts[0] : '';
            const existingHasValidInitial = existingInitial.length === 1 && /[A-Z]/i.test(existingInitial);
            
            // Prefer the entry with a valid initial
            if (hasValidInitial && !existingHasValidInitial) {
              // Replace the invalid initial entry with the valid one
              seen.delete(existing.name);
              seen.set(player.name, player);
              seenBySurname.set(surname, player);
            }
            // If existing has valid initial and new one doesn't, skip the new one
            // If both have valid initials but different, they might be different players (keep both)
            else if (!hasValidInitial || (hasValidInitial && existingHasValidInitial && initial !== existingInitial)) {
              // Different players with same surname, or new one has invalid initial - skip
              continue;
            }
          } else {
            seen.set(player.name, player);
            seenBySurname.set(surname, player);
          }
        } else {
          // If we already have this player but the new one has a price, update it
          const existing = seen.get(player.name);
          if (!existing.price && player.price) {
            seen.set(player.name, player);
            seenBySurname.set(surname, player);
          }
        }
      }
      
      // Keep Y position for Format 2 position assignment
      const orderedPlayers = Array.from(seen.values()).map(player => ({
        name: player.name,
        positions: player.positions,
        price: player.price,
        y: player.y,
        matchIndex: player.matchIndex
      }));
      
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
          // Tesseract configuration for better text extraction from app screenshots
          // PSM 11 = Sparse text - find as much text as possible in no particular order
          // This works better for scattered text layouts like the NRL Fantasy team view
          tessedit_pageseg_mode: '11',
          preserve_interword_spaces: '1',
        });
        
        console.log('OCR Raw Text:', result.data.text);
        setRawText(prev => prev + '\n---IMAGE ' + (imageIndex + 1) + '---\n' + result.data.text);
        
        // Detect which format this screenshot uses
        const format = detectScreenshotFormat(result.data.text);
        
        const players = extractPlayerNamesFromText(result.data.text, result.data.lines);
        console.log('Extracted players:', players);
        
        return {
          players,
          rawText: result.data.text,
          format
        };
      } catch (err) {
        console.error('OCR Error:', err);
        throw err;
      }
    };

    const mergeAndOrderPlayers = (allScreenshotData) => {
      if (allScreenshotData.length === 0) return [];
      
      // Determine the format - if any screenshot is format2, treat all as format2
      const detectedFormat = allScreenshotData.some(d => d.format === 'format2') ? 'format2' : 'format1';
      console.log('Merge using format:', detectedFormat);
      
      if (detectedFormat === 'format2') {
        // Format 2: Merge all players, sort by Y position, then assign positions
        const allPlayers = [];
        let yOffset = 0;
        
        // For Format 2 with multiple screenshots, we need to determine which comes first
        // The screenshot with "BENCH" text likely has later players
        const screenshotsWithBench = [];
        const screenshotsWithoutBench = [];
        
        for (const data of allScreenshotData) {
          const hasBench = /BENCH\s*\(\d+\/\d+\)/i.test(data.rawText);
          if (hasBench) {
            screenshotsWithBench.push(data);
          } else {
            screenshotsWithoutBench.push(data);
          }
        }
        
        // Process screenshots without BENCH first (main team), then with BENCH (bench players)
        const orderedScreenshots = [...screenshotsWithoutBench, ...screenshotsWithBench];
        
        for (let i = 0; i < orderedScreenshots.length; i++) {
          const data = orderedScreenshots[i];
          for (const player of data.players) {
            // Add offset to Y position for subsequent screenshots to maintain order
            allPlayers.push({
              ...player,
              y: (player.y || 0) + yOffset
            });
          }
          // Add a large offset for the next screenshot to ensure proper ordering
          yOffset += 10000;
        }
        
        // Deduplicate while keeping the first occurrence (which should be correctly ordered)
        const seen = new Set();
        const uniquePlayers = allPlayers.filter(p => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          return true;
        });
        
        // Assign positions based on Y-order
        const playersWithPositions = assignFormat2Positions(uniquePlayers);
        
        // Return clean player objects
        return playersWithPositions.map(p => ({
          name: p.name,
          positions: p.positions,
          price: p.price
        }));
      }
      
      // Format 1: Original logic - find HOK player to determine screenshot order
      if (allScreenshotData.length === 1) {
        return allScreenshotData[0].players;
      }
      
      // Find which screenshot should be first (has HOK player at the top)
      let firstScreenshotIndex = 0;
      let earliestHokPosition = Infinity;
      
      for (let i = 0; i < allScreenshotData.length; i++) {
        const players = allScreenshotData[i].players;
        for (let j = 0; j < players.length; j++) {
          const hasHok = players[j].positions && players[j].positions.includes('HOK');
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
        const allData = [...screenshotData, ...newScreenshotData];
        const mergedPlayers = mergeAndOrderPlayers(allData);
        
        console.log('Final merged players:', mergedPlayers);
        
        // Check if any players have missing prices (Format 2 screenshots)
        const hasMissingPrices = mergedPlayers.some(p => !p.price || p.price === 0);
        
        let finalPlayers = mergedPlayers;
        if (hasMissingPrices) {
          console.log('Format 2 detected: Looking up player prices from database...');
          try {
            const playersWithPrices = await lookupPlayerPrices(mergedPlayers);
            // Map the looked-up prices back to the merged players
            finalPlayers = mergedPlayers.map(player => {
              const lookedUp = playersWithPrices.find(p => p.name === player.name);
              return lookedUp ? { ...player, price: lookedUp.price } : player;
            });
            console.log('Players with prices:', finalPlayers);
          } catch (err) {
            console.error('Failed to look up player prices:', err);
            // Continue with original players even if lookup fails
          }
        }
        
        setExtractedPlayers(finalPlayers);
        setScreenshotData(allData);
        
        if (onPlayersExtracted) {
          onPlayersExtracted(finalPlayers);
        }
        
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

    // Tour step configuration for landing page
    const tourSteps = [
      {
        id: 'upload',
        target: '.drop-zone',
        tooltip: 'Upload screenshots of your team. The app will automatically detect the correct order.',
        position: 'bottom',
        waitForAction: false
      },
      {
        id: 'confirm-team',
        target: '.btn-confirm-team',
        tooltip: 'Click here to generate your team from the uploaded screenshots.',
        position: 'top',
        waitForAction: true,
        scrollTo: true
      }
    ];

    // Get current tour step config (only steps 0-1 are for landing page)
    const currentStepConfig = isTourActive && currentTourStep < 2 
      ? tourSteps[currentTourStep] 
      : null;

    // Handle tour progression - auto-advance when user uploads images
    const handleFileChangeWithTour = (e) => {
      handleFileChange(e);
      // If tour is active and on step 0, advance to step 1 after upload
      if (isTourActive && currentTourStep === 0 && e.target.files.length > 0) {
        setTimeout(() => {
          if (onTourNext) onTourNext();
        }, 500);
      }
    };

    return (
      <div className="image-upload-container">
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
            onChange={handleFileChangeWithTour}
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
              <div className="screenshot-examples">
                <img src={screenshotTeam} alt="Team view example" className="example-screenshot" />
                <img src={screenshotBench} alt="Bench view example" className="example-screenshot" />
              </div>
              <p className="upload-text">
                {previewImages.length === 0
                  ? 'Tap to upload screenshots'
                  : 'Tap to add more screenshots'}
              </p>
              <p className="upload-hint">
                {previewImages.length === 0
                  ? 'Upload two screenshots of your team so all players are visible. One screenshot won\'t capture the full squad'
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
            
            <button 
              className="btn-confirm-team"
              onClick={() => {
                onPlayersExtracted?.(extractedPlayers, true);
                // Advance tour if active
                if (isTourActive && currentTourStep === 1 && onTourNext) {
                  setTimeout(() => {
                    onTourNext();
                  }, 100);
                }
              }}
            >
              ✓ Confirm Team
            </button>
          </div>
        )}

        {/* Onboarding Tour */}
        {isTourActive && currentTourStep < 2 && (
          <OnboardingTour
            isActive={isTourActive && currentStepConfig !== null}
            currentStep={currentTourStep}
            totalSteps={10}
            onNext={onTourNext}
            onPrevious={onTourPrevious}
            onSkip={onTourSkip}
            onComplete={() => {
              // On landing page, "Got it" should advance to next step, not complete tour
              // Tour will continue on team view
              if (currentTourStep < 1) {
                onTourNext();
              } else {
                // If on step 1 (confirm team), just advance - tour continues on team view
                onTourNext();
              }
            }}
            stepConfig={currentStepConfig}
          />
        )}
      </div>
    );
  }

  export default ImageUpload;
