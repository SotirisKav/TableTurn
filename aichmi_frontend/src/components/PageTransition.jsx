import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/PageTransition.css';

function PageTransition({ children }) {
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setIsVisible(false);
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 50);

        return () => clearTimeout(timer);
    }, [location.pathname]);

    return (
        <div className={`page-container ${isVisible ? 'visible' : ''}`} key={location.pathname}>
            {children}
        </div>
    );
}

export default PageTransition;