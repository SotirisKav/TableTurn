import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MainContent from './components/MainContent';
//import AboutSection from './components/AboutSection';
import Footer from './components/Footer';
import BrowseRestaurants from './components/BrowseRestaurants';

import './App.css';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={
          <>
            <HeroSection />
            <MainContent />
          </>
        } />
        <Route path="/browse-restaurants" element={<BrowseRestaurants />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;