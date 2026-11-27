// Sample data for the demo kitchen. Paneer is deliberately NOT on today's menu.

export const SAMPLE_MENU = [
  { id: 'thali', names: { en: 'thali', hi: 'थाली', mr: 'थाळी' }, name: 'Thali', price: 120, synonyms: ['thali', 'thaali', 'tiffin', 'dabba', 'meal', 'थाली', 'थाळी', 'थाळ्या', 'टिफिन', 'डब्बा'] },
  { id: 'dal', names: { en: 'dal', hi: 'दाल', mr: 'वरण' }, name: 'Dal', price: 60, synonyms: ['dal', 'daal', 'वरण', 'varan', 'दाल'] },
  { id: 'aloo-gobi', names: { en: 'aloo gobi', hi: 'आलू गोभी', mr: 'आलू गोबी' }, name: 'Aloo gobi', price: 70, synonyms: ['aloo gobi', 'aloo', 'gobi', 'आलू गोभी', 'आलू'] },
  { id: 'roti', names: { en: 'roti', hi: 'रोटी', mr: 'पोळी' }, name: 'Roti', price: 10, synonyms: ['roti', 'chapati', 'chapatti', 'poli', 'phulka', 'रोटी', 'चपाती', 'पोळी'] },
  { id: 'rice', names: { en: 'rice', hi: 'चावल', mr: 'भात' }, name: 'Rice', price: 40, synonyms: ['rice', 'chawal', 'bhaat', 'chaval', 'चावल', 'भात'] },
  { id: 'kanda-bhaji', names: { en: 'kanda bhaji', hi: 'कांदा भजी', mr: 'कांदा भजी' }, name: 'Kanda bhaji', price: 50, synonyms: ['kanda bhaji', 'pyaaz pakoda', 'pyaz pakoda', 'bhaji', 'कांदा भजी', 'भजी'] },
];

// Owner-editable synonyms for ingredients in notes.
export const NOTE_SYNONYMS = {
  'bina pyaaz': ['bina pyaaz', 'bina pyaz', 'no onion', 'without onion', 'kanda nako', 'pyaaz nahi', 'बिना प्याज'],
  'kam teekha': ['kam teekha', 'less spicy', 'kam mirchi', 'कम तीखा'],
};

export const SAMPLE_HOURS = { open: { hour: 11, minute: 0 }, close: { hour: 21, minute: 30 } };

// 8 customers, 3 regulars with a saved usual order.
export const SAMPLE_CUSTOMERS = [
  { id: 'c1', name: 'Sharma', phone: '+91 98200 11111', address: 'B-204, Shanti Niwas, Dadar West', usual: { itemId: 'thali', qty: 2 }, regular: true },
  { id: 'c2', name: 'Gupta', phone: '+91 98200 22222', address: 'Flat 7, Sai Krupa, Parel', usual: { itemId: 'thali', qty: 1 }, regular: true },
  { id: 'c3', name: 'Patil', phone: '+91 98200 33333', address: 'C-12, Gokul Dham, Matunga', usual: { itemId: 'thali', qty: 3 }, regular: true },
  { id: 'c4', name: 'Deshmukh', phone: '+91 98200 44444', address: '3rd floor, Lotus CHS, Prabhadevi', usual: null, regular: false },
  { id: 'c5', name: 'Khan', phone: '+91 98200 55555', address: '', usual: null, regular: false },
  { id: 'c6', name: 'Iyer', phone: '+91 98200 66666', address: 'A-9, Sea View, Worli', usual: null, regular: false },
  { id: 'c7', name: 'Joshi', phone: '+91 98200 77777', address: '', usual: null, regular: false },
  { id: 'c8', name: 'Fernandes', phone: '+91 98200 88888', address: 'Bldg 4, Hindu Colony, Dadar East', usual: null, regular: false },
];
