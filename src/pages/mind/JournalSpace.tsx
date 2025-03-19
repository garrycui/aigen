import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Save, Clock, Award, TrendingUp, Calendar, ChevronLeft, ChevronRight, Palette, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  JournalEntry,
  JournalTheme,
  journalThemes,
  loadJournalEntry,
  saveJournalEntry,
  getMonthEntries,
  getStoredStreak,
  updateStreak,
  getStoredTheme,
  saveThemePreference,
  isToday,
  formatDateKey,
  calculateWordCount,
  getRandomEncouragingMessage,
  clearJournalCaches,
  getTodayKey
} from '../../lib/mind/journal';

const JournalSpace = () => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [streak, setStreak] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [journalEntries, setJournalEntries] = useState<{[date: string]: JournalEntry}>({});
  const [viewMode, setViewMode] = useState<'write' | 'calendar'>('write');
  const [selectedTheme, setSelectedTheme] = useState<JournalTheme>(journalThemes[0]);
  const [encouragingMessage, setEncouragingMessage] = useState('');
  const [isEditable, setIsEditable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const autoSaveRef = useRef<NodeJS.Timeout>();

  // Use refs to avoid unnecessary re-renders
  const contentRef = useRef(content);
  contentRef.current = content;
  
  const wordCountRef = useRef(wordCount);
  wordCountRef.current = wordCount;
  
  const userRef = useRef(user);
  userRef.current = user;
  
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  // Updated load journal data effect with timestamp validation but minimal logging
  useEffect(() => {
    try {
      const dateIsToday = isToday(selectedDate);
      const selectedDateKey = formatDateKey(selectedDate);
      
      setIsEditable(dateIsToday);
      setEncouragingMessage(getRandomEncouragingMessage());

      // Load journal entry for selected date
      if (user) {
        const fetchEntry = async () => {
          setIsLoading(true);
          try {
            const entry = await loadJournalEntry(user.id, selectedDate);
            if (entry) {
              setContent(entry.content);
              setWordCount(entry.wordCount || 0);
              
              // Enhanced timestamp validation and handling without excessive logging
              let validTimestamp = null;
              
              if (entry.timestamp) {
                try {
                  const entryTime = new Date(entry.timestamp);
                  const minDate = new Date(2020, 0, 1).getTime();
                  const maxDate = new Date().getTime() + 86400000;
                  
                  const timeValue = entryTime.getTime();
                  if (!isNaN(timeValue) && timeValue > minDate && timeValue < maxDate) {
                    validTimestamp = entryTime;
                  }
                } catch (timeError) {
                  // Silent catch - no logging
                }
              }
              
              // Use validated timestamp or fallback
              if (validTimestamp) {
                setStartTime(validTimestamp);
                if (isToday(selectedDate)) {
                  const seconds = Math.floor((new Date().getTime() - validTimestamp.getTime()) / 1000);
                  setElapsedTime(Math.max(0, seconds));
                  startTimer();
                }
              } else {
                setStartTime(dateIsToday ? new Date() : null);
                setElapsedTime(0);
                
                if (dateIsToday) {
                  startTimer();
                }
              }
            } else {
              // No existing entry
              setContent('');
              setWordCount(0);
              setStartTime(null);
              setElapsedTime(0);
              
              if (isToday(selectedDate)) {
                setStartTime(new Date());
                startTimer();
              }
            }
          } catch (error) {
            console.error('Error loading journal entry:', error);
            setContent('');
            setWordCount(0);
            setStartTime(null);
            setElapsedTime(0);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchEntry();
      }
    } catch (error) {
      console.error('Unexpected error in journal data loading:', error);
      setIsEditable(false);
      setIsLoading(false);
    }
  }, [selectedDate, user]);

  // Load journal entries for the current month view
  useEffect(() => {
    if (user) {
      const loadEntries = async () => {
        const entries = await getMonthEntries(
          user.id,
          currentMonth.getFullYear(),
          currentMonth.getMonth()
        );
        setJournalEntries(entries);
      };
      
      loadEntries();
    }
  }, [currentMonth, user]);

  // Load saved streak and theme preference from Firestore
  useEffect(() => {
    if (user) {
      const loadSettings = async () => {
        // Load streak from Firestore
        const savedStreak = await getStoredStreak(user.id);
        setStreak(savedStreak);
        
        // Load theme preference from Firestore
        const savedTheme = await getStoredTheme(user.id, journalThemes[0]);
        setSelectedTheme(savedTheme);
      };
      
      loadSettings();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user]);

  // Create a better debounced auto-save with useCallback
  const debouncedSave = useCallback(() => {
    if (!contentRef.current.trim() || !userRef.current || !isEditable) return;
    
    setIsAutoSaving(true);
    saveEntry().finally(() => {
      setIsAutoSaving(false);
    });
  }, [isEditable]);

  // Word count and auto-save logic with optimization
  useEffect(() => {
    // Start timer when typing begins
    if (content && !startTime) {
      setStartTime(new Date());
      startTimer();
    }

    // Update word count - use a more efficient method
    const newCount = calculateWordCount(content);
    if (newCount !== wordCount) {
      setWordCount(newCount);
    }

    // Auto-save with debounce
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }
    
    if (content && user && isEditable) {
      setIsAutoSaving(true);
      autoSaveRef.current = setTimeout(() => {
        debouncedSave();
      }, 2000);
    }

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [content, user, isEditable, debouncedSave]);

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      if (startTime) {
        const seconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
        setElapsedTime(seconds);
      }
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Save current content immediately if needed
  const saveCurrentContent = async () => {
    if (content.trim() && user && isEditable) {
      try {
        // Clear any pending auto-save
        if (autoSaveRef.current) {
          clearTimeout(autoSaveRef.current);
        }

        setIsAutoSaving(true);
        const dateKey = getTodayKey(); // Use getTodayKey to ensure consistency
        
        // Create a properly formatted entry object
        const entry: JournalEntry = {
          content,
          wordCount,
          timestamp: new Date(),
          completed: wordCount >= 500,
          date: dateKey
        };

        try {
          const success = await saveJournalEntry(user.id, entry);
          
          if (success) {
            if (entry.completed) {
              try {
                const newStreak = await updateStreak(user.id, streak);
                setStreak(newStreak);
              } catch (streakError) {
                console.error("Failed to update streak:", streakError);
              }
            }
            
            // Update entries in calendar view
            setJournalEntries(prev => ({
              ...prev,
              [dateKey]: entry
            }));
          }
        } catch (saveError) {
          console.error("Exception during saveJournalEntry:", saveError);
        }
        
        setIsAutoSaving(false);
      } catch (error) {
        console.error('Error in immediate save:', error);
        setIsAutoSaving(false);
      }
    }
  };

  // Memoize the save function to prevent recreating on every render
  const saveEntry = useCallback(async () => {
    if (!contentRef.current.trim() || !userRef.current || !isEditable) return;

    try {
      // Use getTodayKey() from journal.ts to ensure consistent date format
      const dateKey = getTodayKey();
      
      const entry: JournalEntry = {
        content: contentRef.current,
        wordCount: wordCountRef.current,
        timestamp: new Date(),
        completed: wordCountRef.current >= 500,
        date: dateKey // Always use today's date key
      };

      try {
        const success = await saveJournalEntry(userRef.current.id, entry);
        
        if (success) {
          if (entry.completed) {
            try {
              const newStreak = await updateStreak(userRef.current.id, streak);
              setStreak(newStreak);
            } catch (streakError) {
              console.error("Failed to update streak:", streakError);
            }
          }
          
          // Only update the entries map if we're viewing the current month
          if (currentMonth.getMonth() === new Date().getMonth() &&
              currentMonth.getFullYear() === new Date().getFullYear()) {
            setJournalEntries(prev => ({
              ...prev,
              [dateKey]: entry
            }));
          }
        } else {
          // Simple retry without logging
          setTimeout(async () => {
            if (userRef.current) {
              await saveJournalEntry(userRef.current.id, entry);
            }
          }, 1000);
        }
      } catch (error) {
        console.error("Error during auto-save:", error);
      }
    } catch (error) {
      console.error('Error preparing entry for auto-save:', error);
    }
  }, [isEditable, streak, currentMonth]);

  const goToToday = async () => {
    // Save current content before changing date
    await saveCurrentContent();
    
    const today = new Date();
    setSelectedDate(today);
    setViewMode('write');
    
    // If we're not in the current month, switch to it
    if (currentMonth.getMonth() !== today.getMonth() ||
        currentMonth.getFullYear() !== today.getFullYear()) {
      setCurrentMonth(today);
    }
  };

  const handleThemeChange = async (theme: JournalTheme) => {
    setSelectedTheme(theme);
    if (user) {
      await saveThemePreference(user.id, theme.name);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Fix the selectDate function to properly handle calendar date selection
  const selectDate = (date: Date) => {
    // Create a fresh date object to avoid reference issues
    const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateKey = formatDateKey(selectedDay);
    const isTodayDate = isToday(selectedDay);
    
    // Only select dates that have entries or today
    if (journalEntries[dateKey] || isTodayDate) {
      // Add auto-save before switching dates
      if (isEditable && content.trim()) {
        saveCurrentContent().catch(error => {
          console.error("Error saving current content before date change:", error);
        });
      }
      
      // Update the selected date and switch to write mode
      setSelectedDate(selectedDay);
      setViewMode('write');
    }
  };

  // Memoize the calendar days rendering
  const renderCalendarDays = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the first day of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // End on the last day of the week containing the last day
    const endDate = new Date(lastDay);
    const daysToAdd = 6 - endDate.getDay();
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    const days = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const currentDateCopy = new Date(currentDate.getTime()); // Create a proper copy
      const dateKey = formatDateKey(currentDateCopy);
      const isCurrentMonth = currentDateCopy.getMonth() === month;
      const hasEntry = !!journalEntries[dateKey];
      const isSelectedDate = formatDateKey(currentDateCopy) === formatDateKey(selectedDate);
      const todayCheck = isToday(currentDateCopy);
      
      const entryWordCount = hasEntry ? journalEntries[dateKey].wordCount : 0;
      const isSelectable = hasEntry || todayCheck;
      
      days.push(
        <div 
          key={dateKey}
          onClick={() => isSelectable ? selectDate(currentDateCopy) : null}
          className={`
            relative p-2 rounded-lg text-center
            ${isCurrentMonth ? selectedTheme.textColor : 'text-gray-400 opacity-40'} 
            ${hasEntry ? `${selectedTheme.borderColor} border` : ''}
            ${isSelectedDate ? `ring-2 ring-offset-2 ${selectedTheme.accentColor.replace('bg-', 'ring-')}` : ''}
            ${todayCheck ? 'font-bold' : ''}
            ${todayCheck ? 'border-2 border-blue-500' : ''}
            ${isSelectable ? 'cursor-pointer hover:bg-opacity-20 hover:bg-gray-300 transform transition duration-150 hover:scale-105' : 'cursor-not-allowed opacity-50'}
            transition-all duration-200
          `}
        >
          <div className="journal-font">{currentDate.getDate()}</div>
          {hasEntry && (
            <div className={`mt-1 text-xs ${selectedTheme.textColor} font-medium journal-font`}>
              {entryWordCount} words
            </div>
          )}
          {hasEntry && journalEntries[dateKey].completed && (
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>
          )}
          {todayCheck && (
            <div className="absolute bottom-0 left-0 w-full text-xs text-blue-500 journal-font">
              Today
            </div>
          )}
        </div>
      );
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [currentMonth, selectedDate, journalEntries, selectedTheme]);

  // Memoize progress color calculation
  const progressColor = useMemo(() => {
    const progress = (wordCount / 500) * 100;
    if (progress >= 100) return `${selectedTheme.accentColor}`;
    if (progress >= 66) return 'bg-yellow-500';
    if (progress >= 33) return 'bg-orange-500';
    return 'bg-red-500';
  }, [wordCount, selectedTheme.accentColor]);

  // Reset caches when component unmounts
  useEffect(() => {
    return () => {
      if (user) {
        clearJournalCaches(user.id);
      }
    };
  }, []);

  return (
    <div className={`rounded-lg shadow-md overflow-hidden ${selectedTheme.background} transition-colors duration-300`}>
      <div className="p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sniglet:wght@400;800&display=swap');
          
          .journal-font {
            font-family: 'Sniglet', cursive;
          }
        `}</style>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className={`text-2xl font-bold ${selectedTheme.textColor} journal-font tracking-wide`}>
              <span className="relative">
                My Journal
                <span className={`absolute -bottom-1 left-0 w-full h-1 ${selectedTheme.accentColor.replace('bg-', 'bg-opacity-70 bg-')}`}></span>
              </span>
            </h2>
            <p className={`text-sm ${selectedTheme.textColor} opacity-75 journal-font mt-2`}>
              {encouragingMessage}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Today Button */}
            <button
              onClick={goToToday}
              className={`px-3 py-1 rounded-full ${selectedTheme.borderColor} border flex items-center space-x-1 hover:bg-opacity-10 hover:bg-gray-300 transition-all`}
            >
              <span className={`text-sm ${selectedTheme.textColor} journal-font`}>Today</span>
              <ArrowRight className={`h-4 w-4 ${selectedTheme.textColor}`} />
            </button>
            
            {/* Theme Selector */}
            <div className="relative group">
              <button className="p-2 rounded-full hover:bg-gray-200 hover:bg-opacity-20">
                <Palette className={`h-5 w-5 ${selectedTheme.textColor}`} />
              </button>
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10">
                {journalThemes.map((theme) => (
                  <button 
                    key={theme.name}
                    onClick={() => handleThemeChange(theme)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      theme.name === selectedTheme.name ? 'font-bold' : ''
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Calendar Toggle */}
            <button 
              className={`p-2 rounded-full hover:bg-gray-200 hover:bg-opacity-20 ${
                viewMode === 'calendar' ? `${selectedTheme.accentColor} ${selectedTheme.textColor}` : ''
              }`}
              onClick={() => setViewMode(viewMode === 'write' ? 'calendar' : 'write')}
            >
              <Calendar className={`h-5 w-5 ${selectedTheme.textColor}`} />
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className={`mb-6 ${selectedTheme.borderColor} border rounded-lg p-4`}>
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => navigateMonth('prev')} className="p-1 rounded-full hover:bg-gray-200 hover:bg-opacity-20">
                <ChevronLeft className={`h-5 w-5 ${selectedTheme.textColor}`} />
              </button>
              <h3 className={`text-lg font-medium ${selectedTheme.textColor} journal-font`}>
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => navigateMonth('next')} className="p-1 rounded-full hover:bg-gray-200 hover:bg-opacity-20">
                <ChevronRight className={`h-5 w-5 ${selectedTheme.textColor}`} />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={`text-center text-xs font-medium ${selectedTheme.textColor} journal-font`}>{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {renderCalendarDays()}
            </div>
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className={`animate-pulse ${selectedTheme.textColor} journal-font`}>Loading...</div>
              </div>
            ) : (
              <>
                <div className={`mb-4 flex items-center`}>
                  <div className="flex-1">
                    <p className={`text-sm ${selectedTheme.textColor} journal-font`}>
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      {!isEditable && <span className="ml-2 text-amber-600 font-bold journal-font">(Read-only)</span>}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Clock className={`h-5 w-5 ${selectedTheme.textColor} opacity-75`} />
                      <span className={`text-sm ${selectedTheme.textColor} journal-font`}>{formatTime(elapsedTime)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className={`h-5 w-5 ${selectedTheme.textColor} opacity-75`} />
                      <span className={`text-sm ${selectedTheme.textColor} journal-font`}>{wordCount} words</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Award className={`h-5 w-5 ${selectedTheme.textColor}`} />
                      <span className={`text-sm font-medium ${selectedTheme.textColor} journal-font`}>{streak} day streak</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className={`${selectedTheme.textColor} journal-font`}>Progress to 500 words</span>
                    <span className={`${selectedTheme.textColor} journal-font`}>{Math.min(Math.round((wordCount / 500) * 100), 100)}%</span>
                  </div>
                  <div className={`h-2 bg-gray-200 bg-opacity-30 rounded-full overflow-hidden`}>
                    <div
                      className={`h-full transition-all duration-500 ${progressColor}`}
                      style={{ width: `${Math.min((wordCount / 500) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Writing Area */}
                <div className="relative">
                  <textarea
                    value={content}
                    onChange={(e) => isEditable ? setContent(e.target.value) : null}
                    placeholder="Start writing... Let your thoughts flow freely without editing or censoring. This is your safe space to explore your mind."
                    disabled={!isEditable}
                    className={`w-full h-[400px] p-4 journal-font rounded-lg resize-none ${selectedTheme.background} ${selectedTheme.textColor} ${selectedTheme.borderColor} border focus:ring-2 focus:ring-opacity-50 focus:ring-${selectedTheme.accentColor.replace('bg-', '')} focus:border-transparent`}
                  />
                  {isAutoSaving && (
                    <div className="absolute bottom-4 right-4 flex items-center space-x-2 text-sm text-gray-500">
                      <Save className="h-4 w-4 animate-pulse" />
                      <span className="journal-font">Saving...</span>
                    </div>
                  )}
                </div>

                {/* Writing Stats */}
                {wordCount >= 500 && (
                  <div className={`mt-6 p-4 bg-green-50 bg-opacity-80 border border-green-200 rounded-lg ${selectedTheme.name === 'Dark' ? 'text-green-300' : 'text-green-700'} transform transition-all duration-300 hover:scale-[1.01]`}>
                    <div className="flex items-center space-x-2">
                      <Award className="h-5 w-5 text-green-500" />
                      <span className="font-medium journal-font">
                        Congratulations! You've reached today's goal of 500 words!
                      </span>
                    </div>
                  </div>
                )}

                {/* Journey Message for New Users */}
                {wordCount < 10 && (
                  <div className={`mt-6 p-4 ${selectedTheme.borderColor} border rounded-lg`}>
                    <h3 className={`font-medium mb-2 ${selectedTheme.textColor} journal-font`}>Why Journal?</h3>
                    <p className={`text-sm ${selectedTheme.textColor} mb-2 journal-font`}>
                      Writing just 500 words daily has been shown to:
                    </p>
                    <ul className={`text-sm ${selectedTheme.textColor} list-disc pl-5 space-y-1 journal-font`}>
                      <li>Reduce stress and anxiety</li>
                      <li>Improve mood and emotional intelligence</li>
                      <li>Enhance memory and problem-solving</li>
                      <li>Boost creativity and self-understanding</li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Create a memoized version of the component to prevent unnecessary re-renders
export default JournalSpace;