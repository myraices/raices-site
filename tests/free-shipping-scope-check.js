const fs=require('fs');
const path=require('path');
const file=fs.readFileSync(path.join(__dirname,'..','netlify','functions','create-square-checkout.js'),'utf8');
if(!file.includes('let quotedShipment = null;')) throw new Error('quotedShipment outer scope missing');
if(file.includes('const quotedShipment=await shippoGet(')) throw new Error('block-scoped quotedShipment regression');
if(!file.includes('quotedShipment=await shippoGet(')) throw new Error('quotedShipment assignment missing');
console.log('free-shipping scope regression check passed');
