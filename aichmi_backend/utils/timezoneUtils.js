/**
 * Timezone utilities for AICHMI system
 * Handles all date/time operations with Athens/Greece timezone awareness
 */

import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { parseISO, addDays, addWeeks, startOfDay, endOfDay, parse } from 'date-fns';

const ATHENS_TIMEZONE = 'Europe/Athens';

export class TimezoneUtils {
    /**
     * Get current date/time in Athens timezone
     */
    static getCurrentAthensTime() {
        return toZonedTime(new Date(), ATHENS_TIMEZONE);
    }

    /**
     * Get current date in Athens timezone (YYYY-MM-DD format)
     */
    static getCurrentAthensDate() {
        return formatInTimeZone(new Date(), ATHENS_TIMEZONE, 'yyyy-MM-dd');
    }

    /**
     * Get current time in Athens timezone (HH:mm format)
     */
    static getCurrentAthensTimeString() {
        return formatInTimeZone(new Date(), ATHENS_TIMEZONE, 'HH:mm');
    }

    /**
     * Get tomorrow's date in Athens timezone
     */
    static getTomorrowAthensDate() {
        const today = this.getCurrentAthensTime();
        const tomorrow = addDays(today, 1);
        return formatInTimeZone(tomorrow, ATHENS_TIMEZONE, 'yyyy-MM-dd');
    }

    /**
     * Get date for relative terms (today, tomorrow, next week, etc.)
     */
    static getRelativeDate(relativeTerm) {
        const today = this.getCurrentAthensTime();
        const lowerTerm = relativeTerm.toLowerCase();

        switch (lowerTerm) {
            case 'today':
                return formatInTimeZone(today, ATHENS_TIMEZONE, 'yyyy-MM-dd');
            case 'tomorrow':
                return formatInTimeZone(addDays(today, 1), ATHENS_TIMEZONE, 'yyyy-MM-dd');
            case 'next week':
                return formatInTimeZone(addWeeks(today, 1), ATHENS_TIMEZONE, 'yyyy-MM-dd');
            case 'monday':
                return this.getNextWeekday(1); // Monday
            case 'tuesday':
                return this.getNextWeekday(2); // Tuesday
            case 'wednesday':
                return this.getNextWeekday(3); // Wednesday
            case 'thursday':
                return this.getNextWeekday(4); // Thursday
            case 'friday':
                return this.getNextWeekday(5); // Friday
            case 'saturday':
                return this.getNextWeekday(6); // Saturday
            case 'sunday':
                return this.getNextWeekday(0); // Sunday
            default:
                return null;
        }
    }

    /**
     * Get next occurrence of a specific weekday
     */
    static getNextWeekday(targetDay) {
        const today = this.getCurrentAthensTime();
        const currentDay = today.getDay();
        let daysUntilTarget = targetDay - currentDay;
        
        // If the target day is today or in the past this week, get next week's occurrence
        if (daysUntilTarget <= 0) {
            daysUntilTarget += 7;
        }
        
        const targetDate = addDays(today, daysUntilTarget);
        return formatInTimeZone(targetDate, ATHENS_TIMEZONE, 'yyyy-MM-dd');
    }

    /**
     * Format date for display (human-readable)
     */
    static formatDateForDisplay(dateString) {
        try {
            const date = parseISO(dateString);
            return formatInTimeZone(date, ATHENS_TIMEZONE, 'MMMM d, yyyy');
        } catch (error) {
            console.error('Error formatting date for display:', error);
            return dateString;
        }
    }

    /**
     * Format time for display (12-hour format)
     */
    static formatTimeForDisplay(timeString) {
        try {
            if (timeString.includes('pm') || timeString.includes('am')) {
                return timeString;
            }
            
            const [hours, minutes] = timeString.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'pm' : 'am';
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
            return `${displayHour}${minutes === '00' ? '' : ':' + minutes}${ampm}`;
        } catch (error) {
            console.error('Error formatting time for display:', error);
            return timeString;
        }
    }

    /**
     * Get current year in Athens timezone
     */
    static getCurrentYear() {
        return formatInTimeZone(new Date(), ATHENS_TIMEZONE, 'yyyy');
    }

    /**
     * Get day name for a given date
     */
    static getDayName(dateString) {
        try {
            const date = parseISO(dateString);
            return formatInTimeZone(date, ATHENS_TIMEZONE, 'EEEE'); // Full day name
        } catch (error) {
            console.error('Error getting day name:', error);
            return '';
        }
    }

    /**
     * Check if a date is today in Athens timezone
     */
    static isToday(dateString) {
        const today = this.getCurrentAthensDate();
        return dateString === today;
    }

    /**
     * Check if a date is tomorrow in Athens timezone
     */
    static isTomorrow(dateString) {
        const tomorrow = this.getTomorrowAthensDate();
        return dateString === tomorrow;
    }

    /**
     * Get next 7 days with date info for AI context
     */
    static getNext7Days() {
        const today = this.getCurrentAthensTime();
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const dayName = formatInTimeZone(date, ATHENS_TIMEZONE, 'EEEE');
            const dateString = formatInTimeZone(date, ATHENS_TIMEZONE, 'yyyy-MM-dd');
            const displayDate = formatInTimeZone(date, ATHENS_TIMEZONE, 'MMMM d');
            
            days.push({
                dayName,
                dateString,
                displayDate,
                isToday: i === 0,
                isTomorrow: i === 1
            });
        }
        
        return days;
    }

    /**
     * Parse user date input and convert to YYYY-MM-DD format
     */
    static parseUserDate(userInput) {
        const input = userInput.toLowerCase().trim();
        
        // Handle relative terms
        const relativeDate = this.getRelativeDate(input);
        if (relativeDate) {
            return relativeDate;
        }
        
        // Handle "3 august", "august 3", "3rd august" patterns
        const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        // Pattern: "3 august" or "august 3"
        const datePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
        const match = input.match(datePattern);
        
        if (match) {
            const day = match[1] || match[4];
            const month = match[2] || match[3];
            const monthIndex = monthNames.indexOf(month.toLowerCase());
            
            if (monthIndex !== -1 && day) {
                const currentYear = parseInt(this.getCurrentYear());
                const currentDate = this.getCurrentAthensTime();
                const currentMonth = currentDate.getMonth();
                
                // If the requested month has passed this year, assume next year
                let year = currentYear;
                if (monthIndex < currentMonth || 
                    (monthIndex === currentMonth && parseInt(day) < currentDate.getDate())) {
                    year = currentYear + 1;
                }
                
                const targetDate = new Date(year, monthIndex, parseInt(day));
                return formatInTimeZone(targetDate, ATHENS_TIMEZONE, 'yyyy-MM-dd');
            }
        }
        
        return null;
    }

    /**
     * Convert user time input to 24-hour format
     */
    static parseUserTime(userInput) {
        const input = userInput.toLowerCase().trim();
        console.log('🔍 DEBUG parseUserTime input:', input);
        
        // More specific pattern that prioritizes explicit time markers (pm/am) and context words
        // Look for explicit pm/am first, then time context words, avoid matching party size numbers
        const timePatterns = [
            // Pattern 1: Explicit pm/am (highest priority)
            /(\d{1,2})(?::(\d{2}))?\s*(pm|am)/i,
            // Pattern 2: "at" followed by time
            /at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(pm|am))?/i,
            // Pattern 3: o'clock
            /(\d{1,2})\s*o'?clock/i
        ];
        
        for (const pattern of timePatterns) {
            const match = input.match(pattern);
            console.log('🔍 DEBUG timePattern match:', match);
            
            if (match) {
                let hour = parseInt(match[1]);
                const minute = match[2] || '00';
                const period = match[3]?.toLowerCase();
                console.log('🔍 DEBUG parsed components:', { hour, minute, period });
                
                // Handle 12-hour to 24-hour conversion
                if (period === 'pm' && hour !== 12) {
                    hour += 12;
                } else if (period === 'am' && hour === 12) {
                    hour = 0;
                } else if (!period && hour <= 12) {
                    // If no period specified and hour is reasonable for PM, assume PM for dinner times
                    if (hour >= 6 && hour <= 11) {
                        hour += 12;
                    }
                }
                
                const result = `${hour.toString().padStart(2, '0')}:${minute}`;
                console.log('🔍 DEBUG final time result:', result);
                return result;
            }
        }
        
        return null;
    }

    /**
     * Get current context for AI system prompts
     */
    static getCurrentContext() {
        const now = this.getCurrentAthensTime();
        const today = this.getCurrentAthensDate();
        const tomorrow = this.getTomorrowAthensDate();
        const currentTime = this.getCurrentAthensTimeString();
        const next7Days = this.getNext7Days();
        
        return {
            currentDateTime: formatInTimeZone(now, ATHENS_TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz'),
            timezone: ATHENS_TIMEZONE,
            today: {
                date: today,
                display: this.formatDateForDisplay(today),
                dayName: this.getDayName(today)
            },
            tomorrow: {
                date: tomorrow,
                display: this.formatDateForDisplay(tomorrow),
                dayName: this.getDayName(tomorrow)
            },
            currentTime: {
                time24: currentTime,
                time12: this.formatTimeForDisplay(currentTime)
            },
            currentYear: this.getCurrentYear(),
            next7Days
        };
    }
}

export default TimezoneUtils;