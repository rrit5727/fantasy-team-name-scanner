import { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { lookupPlayerPrices, fetchPlayerValidationList, validateExtractedPlayers } from '../services/tradeApi';
import OnboardingTour from './OnboardingTour';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Download, Trash2, ArrowUp, ArrowDown, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import screenshotBench from '../assets/screenshot-bench.jpg';
import screenshotTeam from '../assets/screenshot-team.jpg';

// Expected position structure for a full NRL Fantasy team
const EXPECTED_POSITIONS = [
  { pos: 'HOK', count: 1 },
  { pos: 'MID', count: 3 },
  { pos: 'EDG', count: 2 },
  { pos: 'HLF', count: 2 },
  { pos: 'CTR', count: 2 },
  { pos: 'WFB', count: 3 },
  { pos: 'INT', count: 4 },
  { pos: 'EMG', count: 4 },
];
const TOTAL_EXPECTED_PLAYERS = 21;

// Define which positions are valid for each slot index
// Slots 0: HOK, Slots 1-3: MID, Slots 4-5: EDG, Slots 6-7: HLF, 
// Slots 8-9: CTR, Slots 10-12: WFB, Slots 13-16: INT (any), Slots 17-20: EMG (any)
const SLOT_POSITION_RULES = {
  0: ['HOK'],           // Slot 1 - HOK only
  1: ['MID'],           // Slot 2 - MID only
  2: ['MID'],           // Slot 3 - MID only
  3: ['MID'],           // Slot 4 - MID only
  4: ['EDG'],           // Slot 5 - EDG only
  5: ['EDG'],           // Slot 6 - EDG only
  6: ['HLF'],           // Slot 7 - HLF only
  7: ['HLF'],           // Slot 8 - HLF only
  8: ['CTR'],           // Slot 9 - CTR only
  9: ['CTR'],           // Slot 10 - CTR only
  10: ['WFB'],          // Slot 11 - WFB only
  11: ['WFB'],          // Slot 12 - WFB only
  12: ['WFB'],          // Slot 13 - WFB only
  // INT and EMG slots accept any position
  13: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // INT slot 1
  14: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // INT slot 2
  15: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // INT slot 3
  16: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // INT slot 4
  17: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // EMG slot 1
  18: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // EMG slot 2
  19: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // EMG slot 3
  20: ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB'],  // EMG slot 4
};

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
  const [validPlayerList, setValidPlayerList] = useState([]);
  const [autocompleteState, setAutocompleteState] = useState({
    activeSlot: null, // Index of slot being edited
    searchText: '',
    suggestions: []
  });
  const fileInputRef = useRef(null);
  const autocompleteInputRef = useRef(null);

  // Fetch the player validation list on mount (for OCR validation)
  useEffect(() => {
    const loadValidPlayers = async () => {
      try {
        const players = await fetchPlayerValidationList();
        setValidPlayerList(players);
        console.log(`Loaded ${players.length} players for OCR validation`);
      } catch (err) {
        console.error('Failed to load player validation list:', err);
      }
    };
    loadValidPlayers();
  }, []);

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

  // Known dopplegangers - players with same initial + surname but different positions
  // Format: { "abbreviated_name": [{ fullName, positions }, { fullName, positions }] }
  // These are hardcoded to handle ambiguous lookups based on slot requirements
  const KNOWN_DOPPLEGANGERS = {
    'b. smith': [
      { fullName: 'Brandon Smith', positions: ['HOK', 'MID'] },
      { fullName: 'Billy Smith', positions: ['CTR'] }
    ],
    'b. burns': [
      { fullName: 'Braidon Burns', positions: ['WFB'] },
      { fullName: 'Billy Burns', positions: ['EDG'] }
    ],
    't. may': [
      { fullName: 'Terrell May', positions: ['MID'] },
      { fullName: 'Taylan May', positions: ['CTR'] }
    ],
    'j. paulo': [
      { fullName: 'Junior Paulo', positions: ['MID'] },
      { fullName: 'Jaxson Paulo', positions: ['WFB'] }
    ],
    'j. papalii': [
      { fullName: 'Josh Papalii', positions: ['MID'] },
      { fullName: 'Joash Papalii', positions: ['WFB'] }
    ],
    's. fainu': [
      { fullName: 'Samuela Fainu', positions: ['EDG'] },
      { fullName: 'Sione Fainu', positions: ['MID'] }
    ],
    'm. feagai': [
      { fullName: 'Mathew Feagai', positions: ['WFB'] },
      { fullName: 'Max Feagai', positions: ['CTR'] }
    ],
    'j. walsh': [
      { fullName: 'Joey Walsh', positions: ['HLF'] },
      { fullName: 'James Walsh', positions: ['EDG'] }
    ]
  };

  // Helper to get player's actual positions from validation list
  // IMPORTANT: Handles dopplegangers by choosing the player whose position fits the target slot
  // @param slotIndex - optional slot index to disambiguate dopplegangers
  const getPlayerPositions = (playerName, validationList, slotIndex = null) => {
    if (!playerName || !validationList || validationList.length === 0) return null;
    
    const normalizedName = playerName.toLowerCase().trim();
    
    // CHECK FOR DOPPLEGANGERS FIRST - if this is a known doppleganger name
    const dopplegangers = KNOWN_DOPPLEGANGERS[normalizedName];
    if (dopplegangers && slotIndex !== null) {
      const slotPositions = SLOT_POSITION_RULES[slotIndex];
      if (slotPositions) {
        // Find which doppleganger fits this slot
        for (const doppleganger of dopplegangers) {
          const fits = doppleganger.positions.some(pos => slotPositions.includes(pos));
          if (fits) {
            console.log(`🎭 Doppleganger disambiguation: "${playerName}" at slot ${slotIndex + 1} → ${doppleganger.fullName} [${doppleganger.positions.join('/')}]`);
            return doppleganger.positions;
          }
        }
        // No doppleganger fits - return first one's positions (will fail slot check)
        console.log(`⚠️ Doppleganger "${playerName}" - no variant fits slot ${slotIndex + 1}, using ${dopplegangers[0].fullName}`);
        return dopplegangers[0].positions;
      }
    }
    
    // STANDARD LOOKUP: Try exact abbreviated name match (highest priority)
    let match = validationList.find(p => 
      p.abbreviatedName?.toLowerCase() === normalizedName
    );
    
    // SECOND: Try initial + surname match
    if (!match) {
      const nameMatch = normalizedName.match(/^([a-z])\.?\s*(.+)$/);
      if (nameMatch) {
        const [, initial, surname] = nameMatch;
        match = validationList.find(p =>
          p.initial?.toLowerCase() === initial &&
          p.surname?.toLowerCase() === surname.toLowerCase()
        );
      }
    }
    
    // THIRD: Surname-only match (least reliable - log warning)
    if (!match) {
      const surnameOnly = normalizedName.match(/\.\s*(.+)$/)?.[1] || normalizedName;
      match = validationList.find(p => 
        p.surname?.toLowerCase() === surnameOnly.toLowerCase()
      );
      if (match) {
        console.log(`⚠️ Position lookup for "${playerName}" used surname-only match - may be incorrect`);
      }
    }
    
    return match?.positions || null;
  };

  // Check if a player's positions allow them to be placed in a specific slot
  const canPlayerFitSlot = (playerPositions, slotIndex) => {
    if (!playerPositions || playerPositions.length === 0) {
      // Unknown position - allow for now (will be caught by database validation later)
      return true;
    }
    
    const validPositions = SLOT_POSITION_RULES[slotIndex];
    if (!validPositions) return true; // No rules for this slot
    
    // Player can fit if ANY of their positions matches the slot's valid positions
    return playerPositions.some(pos => validPositions.includes(pos));
  };

  // Assign positions to players based on Y-position ordering (for Format 2)
  // Uses position validation to detect missed scans (inserts empty slots when player doesn't fit)
  // This prevents players from being allocated to wrong position slots
  const assignFormat2Positions = (players, validationList = []) => {
    const sorted = [...players].sort((a, b) => a.y - b.y || a.matchIndex - b.matchIndex);
    const result = [];
    
    console.log(`Format 2: Assigning ${sorted.length} players with position validation...`);
    
    let playerIndex = 0; // Track current position in player queue
    
    // Fill all 21 slots
    for (let slotIndex = 0; slotIndex < TOTAL_EXPECTED_PLAYERS; slotIndex++) {
      const slotPosition = getPositionForSlot(slotIndex);
      const validSlotPositions = SLOT_POSITION_RULES[slotIndex];
      
      // Check if we have a player and if they fit this slot
      if (playerIndex < sorted.length && sorted[playerIndex].name) {
        const player = sorted[playerIndex];
        const playerPositions = getPlayerPositions(player.name, validationList, slotIndex);
        
        // Check if player fits this slot
        if (canPlayerFitSlot(playerPositions, slotIndex)) {
          // Player fits - assign to slot
          result.push({
            ...player,
            positions: [slotPosition],
            isEmpty: false,
            slotIndex: slotIndex
          });
          playerIndex++; // Move to next player
          console.log(`  Slot ${slotIndex + 1} (${slotPosition}): ${player.name} ✓`);
        } else {
          // Player doesn't fit - insert empty slot, keep player for next slot
          result.push({
            name: null,
            positions: [slotPosition],
            price: null,
            isEmpty: true,
            slotIndex: slotIndex
          });
          console.log(`  Slot ${slotIndex + 1} (${slotPosition}): EMPTY (${player.name} doesn't fit - has ${playerPositions?.join('/')})`);
        }
      } else {
        // No more players - insert empty slot
        result.push({
          name: null,
          positions: [slotPosition],
          price: null,
          isEmpty: true,
          slotIndex: slotIndex
        });
        console.log(`  Slot ${slotIndex + 1} (${slotPosition}): EMPTY (no more players)`);
      }
    }
    
    // Log any players that couldn't be placed
    if (playerIndex < sorted.length) {
      const unplaced = sorted.slice(playerIndex).map(p => p.name);
      console.log(`⚠️ ${unplaced.length} players couldn't be placed:`, unplaced);
    }
    
    return result;
  };

  // Force rebuild trigger
  /**
   * Check if text at given coordinates appears on a green background
   * Used to filter out user account names which appear on cyan/green header
   * @param {File} imageFile - The image file being processed
   * @param {Object} bbox - Bounding box from Tesseract {x0, y0, x1, y1}
   * @returns {Promise<boolean>} - True if background is predominantly green
   */
  const hasGreenBackground = async (imageFile, bbox) => {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Sample points around the text bounding box
          const samplePoints = [
            { x: bbox.x0 - 10, y: bbox.y0 - 10 }, // Top-left
            { x: bbox.x1 + 10, y: bbox.y0 - 10 }, // Top-right
            { x: bbox.x0 - 10, y: bbox.y1 + 10 }, // Bottom-left
            { x: (bbox.x0 + bbox.x1) / 2, y: bbox.y0 - 15 }, // Top-center
          ];

          let greenPixelCount = 0;
          let totalSampled = 0;

          samplePoints.forEach(point => {
            if (point.x >= 0 && point.x < img.width && point.y >= 0 && point.y < img.height) {
              const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
              const [r, g, b] = pixel;

              // Detect cyan/green background (high green, low red, variable blue)
              // Green header has RGB approximately (0-100, 200-255, 150-255)
              const isGreenish = g > 180 && r < 120 && (g - r) > 80;

              if (isGreenish) greenPixelCount++;
              totalSampled++;
            }
          });

          // If majority of sampled points are green, text is on green background
          const isGreen = totalSampled > 0 && (greenPixelCount / totalSampled) >= 0.5;
          resolve(isGreen);
        };

        img.onerror = () => resolve(false);
        img.src = URL.createObjectURL(imageFile);

      } catch (err) {
        console.error('Error checking background color:', err);
        resolve(false); // Fail safe - don't filter on error
      }
    });
  };

  // Helper function to get position for a given slot index
  const getPositionForSlot = (slotIndex) => {
    let currentIndex = 0;
    for (const { pos, count } of EXPECTED_POSITIONS) {
      if (slotIndex < currentIndex + count) {
        return pos;
      }
      currentIndex += count;
    }
    return 'EMG'; // Default to EMG if slot exceeds expected
  };

  const extractPlayerNamesFromText = (text, lines) => {
    const players = [];
    
    const namePatterns = [
      /([A-Z])\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([A-Z])\.([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([A-Z])\)\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([A-Z])\)\s+([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /\)\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /\|\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /1\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([a-z])\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /[^A-Za-z]([A-Z])\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /©\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /\+\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /&\s+([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /\*\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /(?:^|[^A-Za-z])([A-Z])\s+([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)(?=[^a-z]|$)/g,
      /[«»]\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /[•●○]\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([0-9])\.\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,  // Handle OCR misreading O as 0
      /[\d<>]\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /([KkDdTtBbVv])[\.\s]+([A-Z][a-zA-Z']{3,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /O([A-Z])[\.\s]*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /Q([a-z])[\.\s]*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /@\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      /®\s*([A-Z])\.?\s*([A-Z][a-zA-Z']{2,}(?:-[A-Z][a-zA-Z']+)*)/g,
      // Handle OCR misreading dot as hyphen (e.g., "u-Whyte" instead of "N. Whyte")
      // Match: space/digit + single letter + hyphen + uppercase surname (not already a hyphenated name)
      /(?:^|\s|\d)([a-zA-Z])-([A-Z][a-z]{2,})(?![a-z]|-[A-Z])/g,
    ];

    // Position pattern - OCR often misreads | as I, 1, l, or [ so we handle all these
    const positionPattern = /[|Il1\[]\s*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG)(?:[,\s]*(HOK|MID|EDG|HLF|CTR|WFB|FRF|2RF|CTW|FLB|INT|EMG))?\s*[|Il1\]]/gi;
    const pricePattern = /\$\s*(\d{2,3})[|lIO0o]?(\d{1,2})k/gi;
    
    const extractFromText = (sourceText, yPosition) => {
      // Debug: Check if we're processing text containing Fa'asuamaleaui
      if (sourceText.includes("Fa'asuamaleaui") || sourceText.includes("Faasuamaleaui")) {
        console.log(`🔍 Processing text containing Faasuamaleaui: "${sourceText}" at y=${yPosition}`);
      }

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
              'tions', 'ptions', 'omplete', 'complete', 'aved', 'swyftx',
              // ADD THESE NEW EXCLUSIONS (team codes):
              'bri', 'syd', 'cby', 'mel', 'gld', 'pen', 'war', 'wst', 'new',
              'man', 'dol', 'nql', 'par', 'cro',
              // ADD THESE (OCR misreads of position markers):
              'imid', 'iedg', 'ihlf', 'ihok', 'iwfb', 'ictr', 'iint', 'iemg',
              'lmid', 'ledg', 'lhlf', 'lhok', 'lwfb', 'lctr', 'lint', 'lemg',
              // ADD THESE NEW EXCLUSIONS for position marker variants:
              'dgi', 'edgi', 'midi', 'hlfi', 'ctri', 'wfbi', 'inti', 'emgi',  // OCR reads 'I' at end
              'ledgi', 'lmidi', 'lhlfi', 'lctri', 'lwfbi', 'linti', 'lemgi',  // 'l' variants with 'i'
              'iedgi', 'imidi', 'ihlfi', 'ictri', 'iwfbi', 'iinti', 'iemgi',  // 'i' variants with 'i'
              // ADD THESE (UI legend keywords that might be parsed as surnames):
              'player', 'trade', 'captain', 'selected', 'injured', 'suspended',
              'emergency', 'favourite', 'favorite', 'uncertain', 'swap', 'remove',
              'vice', 'sub'
          ].includes(lowerSurname)) {
            continue;
          }
          
          const formattedSurname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
          const finalSurname = formattedSurname.replace(/-([a-z])/g, (m, c) => '-' + c.toUpperCase());

          // NEW VALIDATION: Skip if BOTH initial AND surname are suspicious (combined evidence)
          const hasSuspiciousInitial = ['1', '0', 'O', 'o', 'l', 'I'].includes(initial);
          const hasSuspiciousSurname =
            (surname.length === 3 && /^[A-Z]{3}$/.test(surname)) || // 3-letter team codes like "BRI", "SYD"
            /^[Il][A-Z]{2,}$/.test(surname); // Position marker artifacts like "IMID", "IWFB"

          if (hasSuspiciousInitial && hasSuspiciousSurname) {
            // BOTH initial AND surname are suspicious - very likely false positive like "1. Imid"
            continue;
          }

          // Single-factor suspicious elements are handled elsewhere:
          // - Suspicious surnames alone → caught by blacklist above (lines ~246)
          // - Suspicious initials alone → let through, trust database validation

          const fullName = `${initial}. ${finalSurname}`;

          // Debug: Log when we extract Fa'asuamaleaui
          if (fullName.includes("Fa'asuamaleaui") || fullName.includes("Faasuamaleaui")) {
            console.log(`🔍 Extracted Faasuamaleaui: "${fullName}" from text at y=${yPosition}`);
          }

          // FOOTER FILTER: Exclude UI legend text (y > 1200 for typical screenshots)
          // Footer contains text like "Player has been selected", "Trade player"
          const isInFooterRegion = yPosition > 1200;
          if (isInFooterRegion) {
            console.log(`📍 Rejected "${fullName}" - footer region (y=${yPosition})`);
            continue; // Skip this match
          }

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
    
    // Deduplicate by *exact extracted name* only.
    // Then, if we have multiple variants for the same surname, drop the ones with invalid initials
    // (but KEEP distinct valid initials like T. Couchman vs R. Couchman).
    const seen = new Map(); // key: exact extracted name

    for (const player of players) {
      if (!player?.name) continue;

      const key = player.name;
      if (!seen.has(key)) {
        seen.set(key, player);
        continue;
      }

      const existing = seen.get(key);
      // Prefer the version that has a parsed price (format1) if the other doesn't.
      if (!existing.price && player.price) {
        seen.set(key, player);
      }
    }

    const dedupedPlayers = Array.from(seen.values());

    const groupBySurname = new Map(); // surnameLower -> Array<player>
    for (const player of dedupedPlayers) {
      const nameParts = player.name.split('. ');
      const surnameLower = (nameParts.length > 1 ? nameParts[1] : player.name).toLowerCase();
      const group = groupBySurname.get(surnameLower) || [];
      group.push(player);
      groupBySurname.set(surnameLower, group);
    }

    const orderedPlayers = [];
    for (const [, group] of groupBySurname) {
      const hasAnyValidInitial = group.some(p => {
        const parts = p.name.split('. ');
        const init = parts.length > 1 ? parts[0] : '';
        return init.length === 1 && /[A-Z]/.test(init);
      });

      if (!hasAnyValidInitial) {
        orderedPlayers.push(...group);
        continue;
      }

      // If at least one valid-initial entry exists for this surname, drop the invalid-initial ones.
      orderedPlayers.push(
        ...group.filter(p => {
          const parts = p.name.split('. ');
          const init = parts.length > 1 ? parts[0] : '';
          return init.length === 1 && /[A-Z]/.test(init);
        })
      );
    }

    // Preserve original OCR ordering (by y/matchIndex) after filtering
    orderedPlayers.sort((a, b) => (a.y || 0) - (b.y || 0) || (a.matchIndex || 0) - (b.matchIndex || 0));

    const normalizedPlayers = orderedPlayers.map(player => ({
      name: player.name,
      positions: player.positions,
      price: player.price,
      y: player.y,
      matchIndex: player.matchIndex
    }));
    
    return normalizedPlayers;
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
      let players = extractPlayerNamesFromText(result.data.text, result.data.lines);
      console.log('Extracted players (before green filter):', players);

      // Filter out players on green backgrounds (account names)
      const filteredPlayers = [];
      for (const player of players) {
        // Find the line that contains this player's name (only if lines data is available)
        if (result.data.lines && result.data.lines.length > 0) {
          const matchingLine = result.data.lines.find(line =>
            line.text && line.text.includes(player.name)
          );

          if (matchingLine && matchingLine.bbox) {
            const hasGreen = await hasGreenBackground(file, matchingLine.bbox);
            if (hasGreen) {
              console.log(`🟢 Rejected "${player.name}" - green background (account name)`);
              continue; // Skip this player
            }
          }
        }

        filteredPlayers.push(player);
      }
      console.log('Extracted players (after green filter):', filteredPlayers);

      return { players: filteredPlayers, rawText: result.data.text, format, imageFile: file };
    } catch (err) {
      console.error('OCR Error:', err);
      throw err;
    }
  };

  // Helper function to check if a player is a HOK based on their database position
  // IMPORTANT: Handles dopplegangers - if ANY variant is a HOK, returns true
  // (because if they appear first in a screenshot, they're likely the HOK variant)
  const isPlayerHOK = (playerName, validationList) => {
    if (!playerName || !validationList || validationList.length === 0) return null;
    
    const normalizedName = playerName.toLowerCase().trim();
    
    // CHECK FOR DOPPLEGANGERS FIRST
    // If this is a known doppleganger and ANY variant is a HOK, return true
    // (because if they appear first in the screenshot, they're most likely the HOK variant)
    const dopplegangers = KNOWN_DOPPLEGANGERS[normalizedName];
    if (dopplegangers) {
      const anyVariantIsHOK = dopplegangers.some(d => d.positions.includes('HOK'));
      if (anyVariantIsHOK) {
        console.log(`🎭 HOK check for doppleganger "${playerName}": Found HOK variant, assuming correct order`);
        return true;
      } else {
        console.log(`🎭 HOK check for doppleganger "${playerName}": No HOK variant exists`);
        // Continue to standard lookup - all variants are non-HOK
      }
    }
    
    // STANDARD LOOKUP: Find player in validation list by matching name
    const match = validationList.find(p => {
      const abbrevMatch = p.abbreviatedName?.toLowerCase() === normalizedName;
      const surnameMatch = normalizedName.includes(p.surname?.toLowerCase());
      return abbrevMatch || surnameMatch;
    });
    
    if (match && match.positions) {
      console.log(`Position lookup for "${playerName}": positions = ${match.positions.join(', ')}`);
      return match.positions.includes('HOK');
    }
    return null;
  };

  // Determine correct screenshot order based on first player's position
  // First screenshot should contain HOK as the first player (slot 1)
  const determineScreenshotOrder = (screenshotData, validationList) => {
    if (!screenshotData || screenshotData.length < 2) {
      return screenshotData; // No reordering needed for single screenshot
    }
    
    // Get the first player from the first screenshot
    const firstScreenshot = screenshotData[0];
    const firstPlayer = firstScreenshot.players?.[0];
    
    if (!firstPlayer || !firstPlayer.name) {
      console.log('No first player found in first screenshot, using original order');
      return screenshotData;
    }
    
    const isHOK = isPlayerHOK(firstPlayer.name, validationList);
    
    if (isHOK === false) {
      // First player is NOT a HOK - this means screenshots are in wrong order
      console.log(`⚠️ Screenshot order detection: "${firstPlayer.name}" is NOT a HOK. Reversing screenshot order.`);
      return [...screenshotData].reverse();
    } else if (isHOK === true) {
      console.log(`✓ Screenshot order confirmed: "${firstPlayer.name}" IS a HOK. Order is correct.`);
    } else {
      console.log(`? Could not determine position for "${firstPlayer.name}", using original order`);
    }
    
    return screenshotData;
  };

  const mergeAndOrderPlayers = (allScreenshotData, validationList = []) => {
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
      
      // First order by BENCH marker, then apply HOK-based detection
      let orderedScreenshots = [...screenshotsWithoutBench, ...screenshotsWithBench];
      
      // Apply HOK-based ordering if we have validation data
      if (validationList.length > 0) {
        orderedScreenshots = determineScreenshotOrder(orderedScreenshots, validationList);
      }
      
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
      
      // Deduplicate players using exact name matching only (case-insensitive)
      // NOTE: We do NOT use surname-only matching because different players can share surnames
      // (e.g., B. Smith and J. Smith are different players)
      const seen = new Set();
      const uniquePlayers = allPlayers.filter(p => {
        if (!p.name) return true; // Keep empty/null entries
        
        const normalizedName = p.name.toLowerCase().trim();
        
        // Check for exact match only (case-insensitive)
        if (seen.has(normalizedName)) {
          console.log(`🔄 Duplicate removed: "${p.name}"`);
          return false;
        }
        
        seen.add(normalizedName);
        return true;
      });
      
      console.log(`Deduplication: ${allPlayers.length} players -> ${uniquePlayers.length} unique`);
      
      const playersWithPositions = assignFormat2Positions(uniquePlayers, validationList);
      
      // Return with isEmpty flag preserved for empty slots
      return playersWithPositions.map(p => ({
        name: p.name,
        positions: p.positions,
        price: p.price,
        isEmpty: p.isEmpty || false,
        slotIndex: p.slotIndex
      }));
    }
    
    // Format 1: detect position markers and fill in gaps
    if (allScreenshotData.length === 1) {
      return ensureFullTeamSlots(allScreenshotData[0].players);
    }

    // For multiple Format 1 screenshots, separate starting team from bench
    // IMPORTANT: A screenshot with BENCH marker may contain BOTH starting team players (before BENCH)
    // and bench players (after BENCH). We need to split by matchIndex relative to BENCH position.
    
    // SCREENSHOT ORDER DETECTION FOR FORMAT 1
    // Screenshots with "STARTING SIDE" should be processed before screenshots with "BENCH"
    // Also apply HOK-based detection as a backup
    const screenshotsWithStartingSide = [];
    const screenshotsWithBenchOnly = [];
    
    for (const data of allScreenshotData) {
      const hasStartingSide = /STARTING SIDE/i.test(data.rawText);
      if (hasStartingSide) {
        screenshotsWithStartingSide.push(data);
      } else {
        screenshotsWithBenchOnly.push(data);
      }
    }
    
    // Order: starting side screenshots first, then bench-only screenshots
    let orderedFormat1Screenshots = [...screenshotsWithStartingSide, ...screenshotsWithBenchOnly];
    
    // Apply HOK-based detection as additional check
    if (validationList.length > 0 && orderedFormat1Screenshots.length >= 2) {
      // Get first player from the screenshot that should be first (has STARTING SIDE or no BENCH marker)
      const firstScreenshot = orderedFormat1Screenshots[0];
      const firstValidPlayer = firstScreenshot.players?.find(p => p.name && p.name.trim());
      
      if (firstValidPlayer) {
        const isHOK = isPlayerHOK(firstValidPlayer.name, validationList);
        if (isHOK === false) {
          console.log(`⚠️ Format 1 Screenshot order detection: "${firstValidPlayer.name}" is NOT a HOK. Reversing screenshot order.`);
          orderedFormat1Screenshots = orderedFormat1Screenshots.reverse();
        } else if (isHOK === true) {
          console.log(`✓ Format 1 Screenshot order confirmed: "${firstValidPlayer.name}" IS a HOK. Order is correct.`);
        }
      }
    }
    
    console.log(`Format 1: ${screenshotsWithStartingSide.length} screenshots with STARTING SIDE, ${screenshotsWithBenchOnly.length} with BENCH only`);
    
    // Helper function for deduplication (exact name match only, case-insensitive)
    const isDuplicate = (name, seenNames) => {
      if (!name) return false;
      const normalizedName = name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) return true;
      seenNames.add(normalizedName);
      return false;
    };

    const seenStartingNames = new Set();
    const seenBenchNames = new Set();
    const startingPlayers = [];
    const benchPlayers = [];

    for (const data of orderedFormat1Screenshots) {
      const benchMatch = data.rawText.match(/BENCH\s*\(\d+\/\d+\)/i);
      
      if (benchMatch) {
        // This screenshot contains BENCH marker - split players by position
        const benchPosition = benchMatch.index;
        console.log(`Format 1: Screenshot has BENCH marker at position ${benchPosition}`);
        
        for (const player of data.players) {
          // Players BEFORE BENCH marker are starting team, AFTER are bench
          if (player.matchIndex < benchPosition) {
            if (!isDuplicate(player.name, seenStartingNames)) {
              startingPlayers.push(player);
              console.log(`  → Starting team (before BENCH): ${player.name}`);
            } else {
              console.log(`🔄 Format 1 starting duplicate removed: "${player.name}"`);
            }
          } else {
            // Check against both starting and bench players for deduplication
            if (!seenStartingNames.has(player.name?.toLowerCase().trim()) && 
                !isDuplicate(player.name, seenBenchNames)) {
              benchPlayers.push(player);
              console.log(`  → Bench (after BENCH): ${player.name}`);
            } else {
              console.log(`🔄 Format 1 bench duplicate removed: "${player.name}"`);
            }
          }
        }
      } else {
        // No BENCH marker - all players go to starting team
        for (const player of data.players) {
          if (!isDuplicate(player.name, seenStartingNames)) {
            startingPlayers.push(player);
          } else {
            console.log(`🔄 Format 1 starting duplicate removed: "${player.name}"`);
          }
        }
      }
    }
    
    // Add starting names to bench seen set to prevent duplicates across categories
    seenStartingNames.forEach(name => seenBenchNames.add(name));

    console.log(`Format 1: ${startingPlayers.length} starting players, ${benchPlayers.length} bench players (before position validation)`);

    // Build result with starting team (slots 0-12) and bench (slots 13-20)
    // NOW WITH POSITION VALIDATION
    const result = [];
    const STARTING_TEAM_SLOTS = 13; // HOK + 3xMID + 2xEDG + 2xHLF + 2xCTR + 3xWFB

    console.log('Format 1: Assigning starting team with position validation...');

    // Fill starting team slots (0-12) WITH POSITION VALIDATION
    let startingPlayerIndex = 0;
    for (let slotIndex = 0; slotIndex < STARTING_TEAM_SLOTS; slotIndex++) {
      const position = getPositionForSlot(slotIndex);

      if (startingPlayerIndex < startingPlayers.length && startingPlayers[startingPlayerIndex].name) {
        const player = startingPlayers[startingPlayerIndex];
        const playerPositions = getPlayerPositions(player.name, validationList, slotIndex);
        
        // Check if player fits this slot
        if (canPlayerFitSlot(playerPositions, slotIndex)) {
          // Player fits - assign to slot
          result.push({
            ...player,
            positions: [position],
            isEmpty: false,
            slotIndex: slotIndex
          });
          startingPlayerIndex++; // Move to next player
          console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): ${player.name} ✓`);
        } else {
          // Player doesn't fit - insert empty slot, keep player for next slot
          result.push({
            name: null,
            positions: [position],
            price: null,
            isEmpty: true,
            slotIndex: slotIndex
          });
          console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): EMPTY (${player.name} doesn't fit - has ${playerPositions?.join('/')})`);
        }
      } else {
        // No more starting players - insert empty slot
        result.push({
          name: null,
          positions: [position],
          price: null,
          isEmpty: true,
          slotIndex: slotIndex
        });
        console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): EMPTY (no more starting players)`);
      }
    }

    // Log any starting players that couldn't be placed
    if (startingPlayerIndex < startingPlayers.length) {
      const unplacedStarting = startingPlayers.slice(startingPlayerIndex).map(p => p.name);
      console.log(`⚠️ Format 1: ${unplacedStarting.length} starting players couldn't be placed:`, unplacedStarting);
    }

    console.log('Format 1: Assigning bench with position validation...');

    // Fill bench/emergency slots (13-20) WITH POSITION VALIDATION
    let benchPlayerIndex = 0;
    for (let slotIndex = STARTING_TEAM_SLOTS; slotIndex < TOTAL_EXPECTED_PLAYERS; slotIndex++) {
      const position = getPositionForSlot(slotIndex);

      if (benchPlayerIndex < benchPlayers.length && benchPlayers[benchPlayerIndex].name) {
        const player = benchPlayers[benchPlayerIndex];
        const playerPositions = getPlayerPositions(player.name, validationList, slotIndex);
        
        // Check if player fits this slot (INT/EMG slots accept any position, so this will always pass)
        if (canPlayerFitSlot(playerPositions, slotIndex)) {
          // Player fits - assign to slot
          result.push({
            ...player,
            positions: [position],
            isEmpty: false,
            slotIndex: slotIndex
          });
          benchPlayerIndex++; // Move to next player
          console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): ${player.name} ✓`);
        } else {
          // Player doesn't fit - insert empty slot, keep player for next slot
          // NOTE: This branch should rarely/never execute for INT/EMG slots since they accept any position
          result.push({
            name: null,
            positions: [position],
            price: null,
            isEmpty: true,
            slotIndex: slotIndex
          });
          console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): EMPTY (${player.name} doesn't fit - has ${playerPositions?.join('/')})`);
        }
      } else {
        // No more bench players - insert empty slot
        result.push({
          name: null,
          positions: [position],
          price: null,
          isEmpty: true,
          slotIndex: slotIndex
        });
        console.log(`  Format 1 Slot ${slotIndex + 1} (${position}): EMPTY (no more bench players)`);
      }
    }

    // Log any bench players that couldn't be placed
    if (benchPlayerIndex < benchPlayers.length) {
      const unplacedBench = benchPlayers.slice(benchPlayerIndex).map(p => p.name);
      console.log(`⚠️ Format 1: ${unplacedBench.length} bench players couldn't be placed:`, unplacedBench);
    }

    console.log('Format 1 multi-screenshot with position validation: Assigned players:',
      result.map(p => p.isEmpty ? `EMPTY: ${p.positions[0]}` : `${p.name}: ${p.positions[0]}`));

    return result;
  };

  // Ensure we have 21 slots, assigning players in extraction order
  // The position for each slot is determined by the slot index, not the player's detected position
  const ensureFullTeamSlots = (players) => {
    const result = [];

    // Assign valid players to slots 0-N in extraction order
    for (let slotIndex = 0; slotIndex < TOTAL_EXPECTED_PLAYERS; slotIndex++) {
      const position = getPositionForSlot(slotIndex);

      if (slotIndex < players.length && players[slotIndex].name) {
        // We have a valid player for this slot
        result.push({
          ...players[slotIndex],
          positions: [position], // Override with slot's position
          isEmpty: false,
          slotIndex: slotIndex
        });
      } else {
        // Empty slot - no valid player for this position
        result.push({
          name: null,
          positions: [position],
          price: null,
          isEmpty: true,
          slotIndex: slotIndex
        });
      }
    }

    console.log('Format 1: Ensured full team slots:',
      result.map(p => p.isEmpty ? `EMPTY: ${p.positions[0]}` : `${p.name}: ${p.positions[0]}`));
    return result;
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

      // Ensure we have validation list BEFORE merging (needed for HOK-based screenshot ordering)
      let currentValidList = validPlayerList;

      if (currentValidList.length === 0) {
        console.log('Validation list not loaded yet, fetching now...');
        try {
          currentValidList = await fetchPlayerValidationList();
          setValidPlayerList(currentValidList);
        } catch (err) {
          console.warn('Failed to fetch validation list:', err);
        }
      }

      // VALIDATE PLAYERS EARLY - Remove false positives BEFORE position allocation
      // This prevents invalid names like "Tigers" from taking up slots
      const allData = [...screenshotData, ...newScreenshotData];
      if (currentValidList.length > 0) {
        console.log('🔍 Pre-validation: Filtering false positives from OCR before position allocation...');
        
        for (const screenshot of allData) {
          const originalCount = screenshot.players.length;
          const validatedPlayers = validateExtractedPlayers(screenshot.players, currentValidList);
          
          if (validatedPlayers.length < originalCount) {
            const rejected = screenshot.players.filter(p => 
              !validatedPlayers.some(v => v.name === p.name)
            ).map(p => p.name);
            console.log(`   ❌ Rejected from screenshot: ${rejected.join(', ')}`);
          }
          
          // Replace screenshot's player list with validated players only
          screenshot.players = validatedPlayers;
        }
        
        console.log('✅ Pre-validation complete - proceeding with position allocation');
      }

      let mergedPlayers = mergeAndOrderPlayers(allData, currentValidList);

      console.log('Final merged players (before validation):', mergedPlayers);

      // Validate players IN PLACE while preserving slot structure
      let playersInSlots = mergedPlayers; // Start with the properly structured slots from mergeAndOrderPlayers

      if (currentValidList.length > 0) {
        // Secondary validation check (primary validation happens before position allocation)
        const actualPlayers = mergedPlayers.filter(p => !p.isEmpty && p.name);

        console.log(`🔍 Post-validation check: ${actualPlayers.length} players in final slots...`);
        const validatedPlayers = validateExtractedPlayers(actualPlayers, currentValidList);
        const rejectedCount = actualPlayers.length - validatedPlayers.length;

        if (rejectedCount > 0) {
          const rejectedNames = actualPlayers
            .filter(p => !validatedPlayers.some(v => v.name === p.name))
            .map(p => p.name);
          console.log(`⚠️ Post-validation found ${rejectedCount} additional false positives:`, rejectedNames);
          console.log('   ℹ️  These slipped through pre-validation and will be removed.');
        } else {
          console.log('✅ All players in slots are valid');
        }

        // Filter out rejected players completely - don't show them as empty slots
        playersInSlots = mergedPlayers.filter(slot => {
          if (slot.isEmpty) {
            // Keep legitimate empty slots (where no player was detected)
            return true;
          }

          // Check if this player was validated.
          // IMPORTANT: Match by slotIndex (stable) instead of surname heuristics (unstable for shared surnames).
          const validated = validatedPlayers.find(vp => vp.slotIndex === slot.slotIndex);

          // Debug specific names mentioned by user
          if (slot.name && (slot.name.includes("Fa'asuamaleaui") || slot.name.includes("Keeley"))) {
            console.log(`🔍 Slot matching for ${slot.name}:`, {
              slotName: slot.name,
              validatedFound: !!validated,
              validatedName: validated?.name,
              validatedFullName: validated?.fullName,
              matchType: validated?.matchType
            });
          }

          if (validated) {
            // Player is valid - update with validated data (but we'll do this in a separate step)
            return true;
          } else {
            // Player was rejected by database validation - completely remove from list
            console.log(`🗑️ Completely removed false positive: "${slot.name}"`);
            return false;
          }
        }).map(slot => {
          if (slot.isEmpty) {
            return slot;
          }

          // Update valid players with validated data
          const validated = validatedPlayers.find(vp => vp.slotIndex === slot.slotIndex);

          return {
            ...slot,
            name: validated.name,
            fullName: validated.fullName,
            isEmpty: false
          };
        });
      } else {
        console.warn('⚠️ Player validation list not available - cannot filter false positives');
        // Keep the slot structure as-is
        playersInSlots = mergedPlayers;
      }

      console.log('Players in slots after validation:', playersInSlots);

      // Only look up prices for non-empty slots
      const nonEmptyPlayers = playersInSlots.filter(p => !p.isEmpty && p.name);
      const hasMissingPrices = nonEmptyPlayers.some(p => !p.price || p.price === 0);

      let finalPlayers = playersInSlots;
      if (hasMissingPrices && nonEmptyPlayers.length > 0) {
        console.log('Looking up player prices from database...');
        try {
          const playersWithPrices = await lookupPlayerPrices(nonEmptyPlayers);
          finalPlayers = playersInSlots.map(player => {
            if (player.isEmpty || !player.name) {
              return player; // Keep empty slots as-is
            }
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
  }, [onPlayersExtracted, screenshotData, validPlayerList]);

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

  // Autocomplete functions for empty slots
  const filterPlayerSuggestions = (searchText) => {
    if (!searchText || searchText.length < 2 || validPlayerList.length === 0) {
      return [];
    }
    
    const normalizedSearch = searchText.toLowerCase().trim();
    
    // Filter players whose surname or abbreviated name matches
    const matches = validPlayerList.filter(player => {
      const surname = player.surname?.toLowerCase() || '';
      const abbr = player.abbreviatedName?.toLowerCase() || '';
      const fullName = player.fullName?.toLowerCase() || '';
      
      return surname.startsWith(normalizedSearch) || 
             abbr.includes(normalizedSearch) ||
             fullName.includes(normalizedSearch);
    });
    
    // Sort by best match (surname starts with search first)
    matches.sort((a, b) => {
      const aStartsWith = a.surname?.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
      const bStartsWith = b.surname?.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
      return aStartsWith - bStartsWith;
    });
    
    return matches.slice(0, 8); // Limit to 8 suggestions
  };

  const handleAutocompleteInputChange = (e, slotIndex) => {
    const searchText = e.target.value;
    const suggestions = filterPlayerSuggestions(searchText);
    
    setAutocompleteState({
      activeSlot: slotIndex,
      searchText: searchText,
      suggestions: suggestions
    });
  };

  const handleStartEditing = (slotIndex) => {
    setAutocompleteState({
      activeSlot: slotIndex,
      searchText: '',
      suggestions: []
    });
    // Focus the input after state update
    setTimeout(() => {
      autocompleteInputRef.current?.focus();
    }, 50);
  };

  const handleSelectSuggestion = async (player, slotIndex) => {
    // Update the player at this slot with the selected player
    const newPlayer = {
      name: player.abbreviatedName,
      fullName: player.fullName,
      positions: [], // Will be set from slot
      isEmpty: false
    };
    
    // Look up the player's price from database
    try {
      const playersWithPrices = await lookupPlayerPrices([{ name: player.abbreviatedName }]);
      if (playersWithPrices && playersWithPrices.length > 0 && playersWithPrices[0].price) {
        newPlayer.price = playersWithPrices[0].price;
      }
    } catch (err) {
      console.error('Failed to look up price for selected player:', err);
    }
    
    setExtractedPlayers(prev => {
      const updated = [...prev];
      const slot = updated[slotIndex];
      updated[slotIndex] = {
        ...slot,
        ...newPlayer,
        positions: slot.positions, // Keep the slot's position
      };
      return updated;
    });
    
    // Clear autocomplete state
    setAutocompleteState({
      activeSlot: null,
      searchText: '',
      suggestions: []
    });
  };

  const handleCancelAutocomplete = () => {
    setAutocompleteState({
      activeSlot: null,
      searchText: '',
      suggestions: []
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

  // Only show step 1 (confirm button) when the button actually exists (players extracted)
  const currentStepConfig = isTourActive && currentTourStep < 2 
    ? (currentTourStep === 1 && extractedPlayers.length === 0 
        ? null  // Don't show step 1 tooltip until confirm button appears
        : tourSteps[currentTourStep])
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
          <h2 className="text-2xl font-bold text-primary text-center mb-6">
            Team Scanner
          </h2>
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
                    key={`slot-${index}-${player.name || 'empty'}-${player.isEmpty}`}  // More unique key
                    className={cn(
                      "flex items-center p-3 rounded-lg transition-colors group",
                      player.isEmpty 
                        ? "bg-amber-500/10 border border-dashed border-amber-500/40" 
                        : "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <Badge className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center mr-3 shrink-0 text-xs",
                      player.isEmpty && "bg-amber-500/20 text-amber-400"
                    )}>
                      {index + 1}
                    </Badge>
                    <span className={cn(
                      "text-xs font-bold min-w-[50px] text-center mr-3 shrink-0",
                      player.isEmpty ? "text-amber-400" : "text-primary"
                    )}>
                      {player.positions && player.positions.length > 0
                        ? player.positions.join(', ')
                        : '—'}
                    </span>
                    
                    {/* Empty slot with autocomplete */}
                    {player.isEmpty ? (
                      <div className="flex-1 relative">
                        {autocompleteState.activeSlot === index ? (
                          <div className="relative">
                            <Input
                              ref={autocompleteInputRef}
                              type="text"
                              value={autocompleteState.searchText}
                              onChange={(e) => handleAutocompleteInputChange(e, index)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') handleCancelAutocomplete();
                                if (e.key === 'Enter' && autocompleteState.suggestions.length > 0) {
                                  e.preventDefault();
                                  handleSelectSuggestion(autocompleteState.suggestions[0], index);
                                }
                              }}
                              onBlur={() => {
                                // Delay to allow click on suggestion
                                setTimeout(() => {
                                  if (autocompleteState.activeSlot === index) {
                                    handleCancelAutocomplete();
                                  }
                                }, 200);
                              }}
                              placeholder="Type player name..."
                              className="h-8 text-sm bg-background/50"
                              autoFocus
                            />
                            {/* Suggestions dropdown */}
                            {autocompleteState.suggestions.length > 0 && (
                              <div className="absolute top-full left-0 w-[200%] mt-1 bg-card border border-primary/30 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                {autocompleteState.suggestions.map((suggestion, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectSuggestion(suggestion, index);
                                    }}
                                  >
                                    <span className="text-foreground">{suggestion.abbreviatedName}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStartEditing(index); }}
                            className="w-full text-left px-2 py-1 text-amber-400 text-sm italic hover:bg-amber-500/20 rounded transition-colors"
                          >
                            {player.originalFailedName 
                              ? `Click to fix: "${player.originalFailedName}"`
                              : 'Click to add player...'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-foreground font-medium flex-1">
                        {player.name}
                      </span>
                    )}
                    
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
                // Filter out empty slots AND any null/undefined entries
                const filledPlayers = extractedPlayers.filter(p =>
                  !p.isEmpty && p.name && p.name !== null && p.name !== undefined
                );
                console.log('Sending to backend:', filledPlayers);
                onPlayersExtracted?.(filledPlayers, true);
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
          totalSteps={16}
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
