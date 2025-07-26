const fs = require('fs');

// Read the original CSS file
const cssContent = fs.readFileSync('/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/App.css', 'utf8');

// Define sections with their line ranges and target files
const sections = [
  {
    name: 'variables.css',
    start: 1,
    end: 39,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/variables.css'
  },
  {
    name: 'Header.css',
    start: 40,
    end: 118,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Header.css'
  },
  {
    name: 'HeroSection.css', 
    start: 119,
    end: 1383,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/HeroSection.css'
  },
  {
    name: 'Chat.css',
    start: 1384,
    end: 2167,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Chat.css'
  },
  {
    name: 'Confirmation.css',
    start: 2168,
    end: 2321,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Confirmation.css'
  },
  {
    name: 'DoBusiness.css',
    start: 2322,
    end: 2493,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/DoBusiness.css'
  },
  {
    name: 'Subscriptions.css',
    start: 2494,
    end: 2863,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Subscriptions.css'
  },
  {
    name: 'Auth.css',
    start: 2864,
    end: 3042,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Auth.css'
  },
  {
    name: 'Dashboard.css',
    start: 3043,
    end: 4454,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Dashboard.css'
  },
  {
    name: 'Forms.css',
    start: 4455,
    end: 5690,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Forms.css'
  },
  {
    name: 'BrowseRestaurants.css',
    start: 6922,
    end: 7352,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/BrowseRestaurants.css'
  },
  {
    name: 'Reservation.css',
    start: 7156,
    end: 7352,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Reservation.css'
  },
  {
    name: 'PageTransition.css',
    start: 6860,
    end: 6921,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/PageTransition.css'
  },
  {
    name: 'Footer.css',
    start: 298,
    end: 353,
    path: '/Users/sotiriskavadakis/stuff/coding_projects/aichmi/aichmi_frontend/src/styles/Footer.css'
  }
];

// Split the CSS content into lines
const lines = cssContent.split('\n');

// Extract each section
sections.forEach(section => {
  const startIdx = section.start - 1; // Convert to 0-based index
  const endIdx = section.end - 1;
  const sectionLines = lines.slice(startIdx, endIdx + 1);
  const sectionContent = sectionLines.join('\n');
  
  console.log(`Extracting ${section.name} (lines ${section.start}-${section.end})`);
  fs.writeFileSync(section.path, sectionContent);
});

console.log('CSS files split successfully!');