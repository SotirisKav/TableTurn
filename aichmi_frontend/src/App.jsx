import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MainContent from './components/MainContent';
import About from './components/About';
import Footer from './components/Footer';
import BrowseRestaurants from './components/BrowseRestaurants';
import Reservation from './components/Reservation'; 
import ChatWithAichmi from './components/ChatWithAichmi';

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
        <Route path="/browse-festivals" element={<div style={{padding:'4rem',textAlign:'center'}}><h1>Browse Festivals (Coming Soon)</h1><p>Discover Greek festivals and events soon on AICHMI!</p></div>} />
        <Route path="/reservation/:restaurantId" element={<Reservation />} />
        <Route path="/chat/:restaurantId?" element={<ChatWithAichmi />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;