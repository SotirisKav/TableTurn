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
import AdminDashboardSelector from './components/AdminDashboardSelector';
import SimpleRestaurantForm from './components/SimpleRestaurantForm';
import PageTransition from './components/PageTransition';
import './App.css';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={
          <PageTransition>
            <HeroSection />
            <MainContent />
            <DoBusiness />
          </PageTransition>
        } />
        <Route path="/browse-restaurants" element={<PageTransition><BrowseRestaurants /></PageTransition>} />
        <Route path="/browse-festivals" element={<PageTransition><div style={{padding:'4rem',textAlign:'center'}}><h1>Browse Festivals (Coming Soon)</h1><p>Discover Greek festivals and events soon on AICHMI!</p></div></PageTransition>} />
        <Route path="/reservation/:restaurantId" element={<PageTransition><Reservation /></PageTransition>} />
        <Route path="/chat/:restaurantId?" element={<PageTransition><ChatWithAichmi /></PageTransition>} />
        <Route path="/confirmation" element={<PageTransition><Confirmation /></PageTransition>} />
        <Route path="/about" element={<PageTransition><About /></PageTransition>} />
        <Route path="/subscriptions" element={<PageTransition><Subscriptions /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><AdminDashboardSelector /></PageTransition>} />
        <Route path="/dashboard/:restaurantId" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/restaurant-setup" element={<PageTransition><SimpleRestaurantForm /></PageTransition>} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;