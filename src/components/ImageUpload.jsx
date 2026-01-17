import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { lookupPlayerPrices } from '../services/tradeApi';
import OnboardingTour from './OnboardingTour';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Trash2, ArrowUp, ArrowDown, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [screenshotData, setScreenshotData] = useState([]);
  const fileInputRef = useRef(null);

  // Detect which screenshot format is being used
  const detectScreenshotFormat = (rawText) => {
    const hasPositionMarkers = /\|\s*(HOK|MID|EDG|HLF|CTR|WFB)\s*\|/i.test(rawText);
    const hasPriceMarkers = /\$\s*\d{2,3}[|lIO0o]?\d{1,2}k/i.test(rawText);
    
    if (hasPositionMarkers || hasPriceMarkers) {
      console.log('Detected Format 1 (positions/prices visible)');
      return 'format1';
    }
    
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
    const sorted = [...players].sort((a, b) => a.y - b.y || a.matchIndex - b.matchIndex);
    
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
    
    const namePatterns = [
      /([A-Z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /([A-Z])\.([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /([A-Z])\)\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /([A-Z])\)\s+([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /\)\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /\|\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /1\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /([a-z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /[^A-Za-z]([A-Z])\.\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /©\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /\+\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /&\s+([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /\*\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /(?:^|[^A-Za-z])([A-Z])\s+([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)(?=[^a-z]|$)/g,
      /[«»]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /[•●○]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /[\d<>]\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /([KkDdTtBbVv])[\.\s]+([A-Z][a-zA-Z]{3,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /O([A-Z])[\.\s]*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /Q([a-z])[\.\s]*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /@\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
      /®\s*([A-Z])\.?\s*([A-Z][a-zA-Z]{2,}(?:-[A-Z][a-zA-Z]+)*)/g,
    ];

    const positionPattern = /\|\s*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG)(?:[,\s]*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG))?\s*\|/gi;
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
            if (!initial || initial.length === 0) continue;
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
          if (['warriors', 'broncos', 'eels', 'panthers', 'bulldogs', 'titans', 
              'cowboys', 'dragons', 'raiders', 'knights', 'roosters', 'sharks',
              'rabbitohs', 'dolphins', 'mid', 'edg', 'hlf', 'hok', 'wfb', 'ctr',
              'int', 'emg', 'frf', 'score', 'rank', 'overall', 'round', 'team',
              'bench', 'starting', 'side', 'saved', 'options', 'trades', 'rankings',
              'download', 'clear', 'csv', 'players', 'uploaded', 'screenshots',
              'image', 'upload', 'confirm', 'remove', 'move', 'back', 'scanner',
              'tap', 'capture', 'full', 'hisense', 'dnp', 'captain',
              'tions', 'ptions', 'omplete', 'complete', 'aved', 'swyftx'].includes(lowerSurname)) {
            continue;
          }
          
          const formattedSurname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
          const finalSurname = formattedSurname.replace(/-([a-z])/g, (m, c) => '-' + c.toUpperCase());
          const fullName = `${initial}. ${finalSurname}`;
          
          const afterName = sourceText.substring(match.index, match.index + 150);
          positionPattern.lastIndex = 0;
          const posMatch = positionPattern.exec(afterName);
          let positions = [];
          if (posMatch) {
            if (posMatch[1]) positions.push(posMatch[1].toUpperCase());
            if (posMatch[2]) positions.push(posMatch[2].toUpperCase());
          }
          
          pricePattern.lastIndex = 0;
          const priceMatch = pricePattern.exec(afterName);
          let price = null;
          if (priceMatch) {
            const hundreds = priceMatch[1];
            const tens = priceMatch[2];
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
    
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineText = line.text || '';
        const yPos = line.bbox ? line.bbox.y0 : 0;
        extractFromText(lineText, yPos);
      }
    }
    
    extractFromText(text || '', 0);
    players.sort((a, b) => a.y - b.y || a.matchIndex - b.matchIndex);
    
    const seen = new Map();
    const seenBySurname = new Map();
    
    for (const player of players) {
      const nameParts = player.name.split('. ');
      const surname = nameParts.length > 1 ? nameParts[1].toLowerCase() : player.name.toLowerCase();
      const initial = nameParts.length > 1 ? nameParts[0] : '';
      const hasValidInitial = initial.length === 1 && /[A-Z]/i.test(initial);
      
      if (!seen.has(player.name)) {
        if (seenBySurname.has(surname)) {
          const existing = seenBySurname.get(surname);
          const existingParts = existing.name.split('. ');
          const existingInitial = existingParts.length > 1 ? existingParts[0] : '';
          const existingHasValidInitial = existingInitial.length === 1 && /[A-Z]/i.test(existingInitial);
          
          if (hasValidInitial && !existingHasValidInitial) {
            seen.delete(existing.name);
            seen.set(player.name, player);
            seenBySurname.set(surname, player);
          }
          else if (!hasValidInitial || (hasValidInitial && existingHasValidInitial && initial !== existingInitial)) {
            continue;
          }
        } else {
          seen.set(player.name, player);
          seenBySurname.set(surname, player);
        }
      } else {
        const existing = seen.get(player.name);
        if (!existing.price && player.price) {
          seen.set(player.name, player);
          seenBySurname.set(surname, player);
        }
      }
    }
    
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
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
      });
      
      console.log('OCR Raw Text:', result.data.text);
      setRawText(prev => prev + '\n---IMAGE ' + (imageIndex + 1) + '---\n' + result.data.text);
      
      const format = detectScreenshotFormat(result.data.text);
      const players = extractPlayerNamesFromText(result.data.text, result.data.lines);
      console.log('Extracted players:', players);
      
      return { players, rawText: result.data.text, format };
    } catch (err) {
      console.error('OCR Error:', err);
      throw err;
    }
  };

  const mergeAndOrderPlayers = (allScreenshotData) => {
    if (allScreenshotData.length === 0) return [];
    
    const detectedFormat = allScreenshotData.some(d => d.format === 'format2') ? 'format2' : 'format1';
    console.log('Merge using format:', detectedFormat);
    
    if (detectedFormat === 'format2') {
      const allPlayers = [];
      let yOffset = 0;
      
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
      
      const orderedScreenshots = [...screenshotsWithoutBench, ...screenshotsWithBench];
      
      for (let i = 0; i < orderedScreenshots.length; i++) {
        const data = orderedScreenshots[i];
        for (const player of data.players) {
          allPlayers.push({
            ...player,
            y: (player.y || 0) + yOffset
          });
        }
        yOffset += 10000;
      }
      
      const seen = new Set();
      const uniquePlayers = allPlayers.filter(p => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
      
      const playersWithPositions = assignFormat2Positions(uniquePlayers);
      
      return playersWithPositions.map(p => ({
        name: p.name,
        positions: p.positions,
        price: p.price
      }));
    }
    
    if (allScreenshotData.length === 1) {
      return allScreenshotData[0].players;
    }
    
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
    
    const orderedScreenshots = [
      allScreenshotData[firstScreenshotIndex],
      ...allScreenshotData.filter((_, i) => i !== firstScreenshotIndex)
    ];
    
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

      const allData = [...screenshotData, ...newScreenshotData];
      const mergedPlayers = mergeAndOrderPlayers(allData);
      
      console.log('Final merged players:', mergedPlayers);
      
      const hasMissingPrices = mergedPlayers.some(p => !p.price || p.price === 0);
      
      let finalPlayers = mergedPlayers;
      if (hasMissingPrices) {
        console.log('Format 2 detected: Looking up player prices from database...');
        try {
          const playersWithPrices = await lookupPlayerPrices(mergedPlayers);
          finalPlayers = mergedPlayers.map(player => {
            const lookedUp = playersWithPrices.find(p => p.name === player.name);
            return lookedUp ? { ...player, price: lookedUp.price } : player;
          });
          console.log('Players with prices:', finalPlayers);
        } catch (err) {
          console.error('Failed to look up player prices:', err);
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
  }, [onPlayersExtracted, screenshotData]);

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

  const currentStepConfig = isTourActive && currentTourStep < 2 
    ? tourSteps[currentTourStep] 
    : null;

  const handleFileChangeWithTour = (e) => {
    handleFileChange(e);
    if (isTourActive && currentTourStep === 0 && e.target.files.length > 0) {
      setTimeout(() => {
        if (onTourNext) onTourNext();
      }, 500);
    }
  };

  return (
    <div className="image-upload-container w-full max-w-[500px] mx-auto mt-4 flex-1 flex flex-col">
      {/* Drop Zone */}
      <Card
        className={cn(
          "drop-zone border-[3px] border-dashed border-primary/60 rounded-[20px] cursor-pointer transition-all duration-300 relative overflow-hidden min-h-[550px] flex items-center justify-center flex-1",
          isDragging && "border-primary border-solid bg-gradient-to-br from-secondary to-muted",
          isProcessing && "cursor-wait pointer-events-none",
          !isDragging && !isProcessing && "hover:border-primary hover:scale-[1.01]"
        )}
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
          className="hidden"
        />
        
        <CardContent className="p-8 w-full">
          {isProcessing ? (
            <div className="text-center text-foreground">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-lg text-primary mb-4">
                Scanning image {currentImage} of {totalImages}...
              </p>
              <Progress value={progress} className="w-full h-2 mb-2" />
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
          ) : (
            <div className="text-center text-foreground h-full flex flex-col justify-center items-center">
              <div className="flex gap-6 mb-4 justify-center items-center flex-1">
                <img 
                  src={screenshotTeam} 
                  alt="Team view example" 
                  className="w-[200px] h-auto rounded-xl border-2 border-primary/30 transition-all duration-300 cursor-pointer hover:border-primary hover:scale-105 hover:shadow-lg hover:shadow-primary/30"
                />
                <img 
                  src={screenshotBench} 
                  alt="Bench view example" 
                  className="w-[200px] h-auto rounded-xl border-2 border-primary/30 transition-all duration-300 cursor-pointer hover:border-primary hover:scale-105 hover:shadow-lg hover:shadow-primary/30"
                />
              </div>
              <p className="text-xl font-semibold mb-2 text-primary">
                {previewImages.length === 0
                  ? 'Tap to upload screenshots'
                  : 'Tap to add more screenshots'}
              </p>
              <p className="text-sm text-muted-foreground">
                {previewImages.length === 0
                  ? "Upload two screenshots of your team so all players are visible. One screenshot won't capture the full squad"
                  : `${previewImages.length} screenshot${previewImages.length > 1 ? 's' : ''} uploaded`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview Section */}
      {previewImages.length > 0 && (
        <div className="mt-8">
          <h3 className="text-primary mb-4 text-base uppercase tracking-wide font-semibold">
            Uploaded Screenshots ({previewImages.length})
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
            {previewImages.map((img, index) => (
              <div 
                key={index} 
                className="aspect-square rounded-xl overflow-hidden border-2 border-primary/30 relative"
              >
                <img 
                  src={img.url} 
                  alt={`Screenshot ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-primary text-xs font-bold px-1.5 py-0.5 rounded">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Section */}
      {rawText && (
        <Card className="mt-8 border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4">
            <details>
              <summary className="text-amber-400 cursor-pointer text-sm font-semibold list-none">
                <span className="mr-2">▶</span>
                🔍 Show OCR Output (Debug)
              </summary>
              <p className="text-amber-400/70 text-xs mt-3 mb-2">
                Raw text from OCR - check console for detailed logs
              </p>
              <pre className="bg-black/30 rounded-lg p-4 font-mono text-xs text-foreground whitespace-pre-wrap break-words max-h-[250px] overflow-y-auto">
                {rawText}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {extractedPlayers.length > 0 && (
        <Card className="mt-8 border-primary/30">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
              <h3 className="text-primary text-lg uppercase tracking-wide font-semibold">
                Players ({extractedPlayers.length})
              </h3>
              <div className="flex gap-3">
                <Button 
                  onClick={downloadPlayers}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button 
                  variant="outline"
                  onClick={clearAll}
                  className="flex-1"
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            {/* Player List */}
            <ScrollArea className="h-[400px] w-full rounded-md border">
              <ul className="space-y-2 p-4">
                {extractedPlayers.map((player, index) => (
                  <li
                    key={index}
                    className="flex items-center p-3 bg-primary/5 rounded-lg transition-colors hover:bg-primary/10 group"
                  >
                    <Badge className="w-7 h-7 rounded-lg flex items-center justify-center mr-3 shrink-0 text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-primary text-xs font-bold min-w-[50px] text-center mr-3 shrink-0">
                      {player.positions && player.positions.length > 0
                        ? player.positions.join(', ')
                        : '—'}
                    </span>
                    <span className="text-foreground font-medium flex-1">
                      {player.name}
                    </span>
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:bg-primary/20"
                        onClick={(e) => { e.stopPropagation(); movePlayer(index, -1); }}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:bg-primary/20"
                        onClick={(e) => { e.stopPropagation(); movePlayer(index, 1); }}
                        disabled={index === extractedPlayers.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/20"
                        onClick={(e) => { e.stopPropagation(); removePlayer(index); }}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            
            <p className="text-center text-muted-foreground text-sm mt-4">
              💡 Use arrows to reorder, ✕ to remove incorrect entries
            </p>
            
            <Button 
              className="btn-confirm-team w-full mt-6 h-12 text-base uppercase tracking-wide"
              onClick={() => {
                onPlayersExtracted?.(extractedPlayers, true);
                if (isTourActive && currentTourStep === 1 && onTourNext) {
                  setTimeout(() => {
                    onTourNext();
                  }, 100);
                }
              }}
            >
              <Check className="mr-2 h-5 w-5" />
              Confirm Team
            </Button>
          </CardContent>
        </Card>
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
            if (currentTourStep < 1) {
              onTourNext();
            } else {
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
