import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MainContent from './components/MainContent';
import DoBusiness from './components/DoBusiness';
import About from './components/About';
import Footer from './components/Footer';
import BrowseRestaurants from './components/BrowseRestaurants';
import Reservation from './components/Reservation'; 
import ChatWithAichmi from './components/ChatWithAichmi';
import Confirmation from './components/Confirmation';
import Subscriptions from './components/Subscriptions';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SimpleRestaurantForm from './components/SimpleRestaurantForm';
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
            <DoBusiness />
          </>
        } />
        <Route path="/browse-restaurants" element={<BrowseRestaurants />} />
        <Route path="/browse-festivals" element={<div style={{padding:'4rem',textAlign:'center'}}><h1>Browse Festivals (Coming Soon)</h1><p>Discover Greek festivals and events soon on AICHMI!</p></div>} />
        <Route path="/reservation/:restaurantId" element={<Reservation />} />
        <Route path="/chat/:restaurantId?" element={<ChatWithAichmi />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/about" element={<About />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/restaurant-setup" element={<SimpleRestaurantForm />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;