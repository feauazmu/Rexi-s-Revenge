import { palette } from '../palette';
import { defineSprite } from '../sprite';

/**
 * Rexi's Dialogue Box portrait (40×40), after reference/rexi-character-sheet.png: light-brown
 * flat-top, confident grin, sleeveless judge's robe over a white tank top, and his left arm
 * flexed to show the tattoo (a lion head next to a columned courthouse).
 */
export const REXI_PORTRAIT = defineSprite(
  {
    p: '#5c4a8c', // backdrop
    k: palette.outline,
    H: '#b5835a', // hair
    L: '#d8a878', // hair highlight
    h: '#8a5a34', // hair shadow, brows
    S: '#e8b48a', // skin
    l: '#f6cfa8', // skin highlight
    s: '#c48a64', // skin shadow
    t: palette.white, // teeth
    w: '#f2f2f2', // tank top
    g: '#c8c8d8', // tank top shading
    r: '#23202e', // robe
    R: '#3a3448', // robe folds
    A: '#9a5a2a', // tattoo: lion mane
    T: '#4a2a1a', // tattoo: ink
  },
  [
    'pppppppppppppppppppppppppppppppppppppppp',
    'pppppppppppkkkkkkkkkkppppppppppppppppppp',
    'ppppppppppkHLLHHLLHHHkpppppppppppppppppp',
    'pppppppppkHHLLHHHLLHHHkpppppppppkkkkkkpp',
    'pppppppppkhHHHHHHHHHHhkppppppppklSlSlSkp',
    'pppppppppkhhHhhHHhhHhhkpppppppkSSSSSSSkp',
    'pppppppppkhSSSllllSSShkpppppppklSSlSSSkp',
    'pppppppppkShhhSSSShhhSkpppppppkSSsSSsSkp',
    'ppppppppkSSSwkSSSSkwSSSkppppppkssssssSkp',
    'ppppppppkSSSSSSllSSSSSSkppppppkSSSSSSskp',
    'ppppppppksSSSSSlsSSSSSskpppppppkssssskpp',
    'ppppppppkssSSSssssSSSsskpppppppkSSSSskpp',
    'pppppppppksSSSSSSSSSSskppppppppklSSSskpp',
    'pppppppppksSkSSSSSSkSskpppppppklSSSSskpp',
    'pppppppppksSSkttttkSSskpppppppklSSSSskpp',
    'pppppppppkssSSkkkkSSsskpppppppklSSSSsskp',
    'pppppppppkssSSSSSSSSsskpppppppkSSSSSsskp',
    'pppppppppksssSSSSSSssskpppppppkSSSSSsskp',
    'pppppppppkskSSSSSSSSkskppppkkkkSSSSSsskp',
    'pppppppppksskkkkkkkssskpppklllSsSSSSSskp',
    'ppppppkkSSssssssssssssSSSkSlllSSsSSSSskp',
    'ppppkkSSSSsSSSSSSSSSSsSSSSkSSllSSSSSSskp',
    'ppkrrkrSSSSSSSllllSSSSSSrkrSAAASSSSTSSkp',
    'pkrrRrrSSSSSSSSSSSSSSSSSrrkAkSkASSTTTSkp',
    'SSskrrRrrrwwSSSSSSSwwrrrrrkASTSASTTTTTkp',
    'SSskrrRrrrwwwSSSSSwwwrrrrrkAATAASTSTSTkp',
    'SSskrRrrRrwwwwwwwwwwwrrrrrkSAAASSTTTTTkp',
    'SSskrRrrRrwwwwwgwwwwwrrrrrksSSSSSSSSSskp',
    'SSskrRrrRrwwwwwgwwwwwrrrrrkssSSSSSSssskp',
    'sSskrRrrRrgggwwgwwgggrrrrrrksssssssssskp',
    'sSskrRrrRrwwwwwwwwwwwrrrrrrrkkkkkkkkkkpp',
    'SSskrRrrRrwwgwwwwwgwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwgwwwgwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'SSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
    'sSskrRrrRrwwwwwwwwwwwrrrrRrrkppppppppppp',
  ],
);
