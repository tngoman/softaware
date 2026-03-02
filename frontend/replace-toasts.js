// Quick script to replace remaining toast calls with SweetAlert2
const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Contacts.tsx',
  'src/pages/AddExpense.tsx',
  'src/pages/AddIncome.tsx',
  'src/pages/Statement.tsx',
  'src/pages/Transactions.tsx',
  'src/pages/VatReports.tsx',
  'src/pages/Categories.tsx',
  'src/components/UI/PricingModal.tsx'
];

const replacements = [
  // Import replacements
  { from: /import toast from 'react-hot-toast';/g, to: "import Swal from 'sweetalert2';" },
  { from: /import { toast } from 'react-hot-toast';/g, to: "import Swal from 'sweetalert2';" },
  
  // toast.success replacements
  { from: /toast\.success\('([^']+)'\)/g, to: "Swal.fire({ icon: 'success', title: 'Success!', text: '$1', timer: 2000, showConfirmButton: false })" },
  { from: /toast\.success\("([^"]+)"\)/g, to: 'Swal.fire({ icon: "success", title: "Success!", text: "$1", timer: 2000, showConfirmButton: false })' },
  { from: /toast\.success\(`([^`]+)`\)/g, to: 'Swal.fire({ icon: "success", title: "Success!", text: `$1`, timer: 2000, showConfirmButton: false })' },
  
  // toast.error replacements  
  { from: /toast\.error\('([^']+)'\)/g, to: "Swal.fire({ icon: 'error', title: 'Error', text: '$1' })" },
  { from: /toast\.error\("([^"]+)"\)/g, to: 'Swal.fire({ icon: "error", title: "Error", text: "$1" })' },
  { from: /toast\.error\(`([^`]+)`\)/g, to: 'Swal.fire({ icon: "error", title: "Error", text: `$1` })' },
  
  // Complex toast.error with ||
  { from: /toast\.error\(([^)]+)\|\|\s*'([^']+)'\)/g, to: 'Swal.fire({ icon: "error", title: "Error", text: $1|| \'$2\' })' },
  { from: /toast\.error\(([^)]+)\|\|\s*"([^"]+)"\)/g, to: 'Swal.fire({ icon: "error", title: "Error", text: $1|| "$2" })' },
  
  // toast.warning replacements
  { from: /toast\.warning\('([^']+)'\)/g, to: "Swal.fire({ icon: 'warning', title: 'Warning', text: '$1' })" },
  { from: /toast\.warning\("([^"]+)"\)/g, to: 'Swal.fire({ icon: "warning", title: "Warning", text: "$1" })' },
  
  // alert() replacements
  { from: /alert\('([^']+)'\)/g, to: "Swal.fire({ icon: 'info', text: '$1' })" },
  { from: /alert\("([^"]+)"\)/g, to: 'Swal.fire({ icon: "info", text: "$1" })' },
  { from: /alert\(`([^`]+)`\)/g, to: 'Swal.fire({ icon: "info", text: `$1` })' },
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated ${file}`);
  } else {
    console.log(`- No changes needed in ${file}`);
  }
});

console.log('\nDone!');
