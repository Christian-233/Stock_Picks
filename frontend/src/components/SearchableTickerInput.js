import React, { useState, useEffect } from 'react';
import './SearchableTickerInput.css';

// Comprehensive stock database with 100+ popular US stocks
const STOCK_DATABASE = [
  // Tech Giants
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Google' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'AMD', name: 'Advanced Micro Devices' },
  { ticker: 'INTC', name: 'Intel' },
  { ticker: 'IBM', name: 'IBM' },
  { ticker: 'ORCL', name: 'Oracle' },
  { ticker: 'CRM', name: 'Salesforce' },
  { ticker: 'ADBE', name: 'Adobe' },
  { ticker: 'NFLX', name: 'Netflix' },
  { ticker: 'SPOT', name: 'Spotify' },
  { ticker: 'SNAP', name: 'Snap' },
  { ticker: 'PINS', name: 'Pinterest' },
  { ticker: 'RBLX', name: 'Roblox' },
  { ticker: 'ZM', name: 'Zoom' },
  { ticker: 'SLACK', name: 'Slack' },
  
  // Finance/Banking
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'BAC', name: 'Bank of America' },
  { ticker: 'WFC', name: 'Wells Fargo' },
  { ticker: 'GS', name: 'Goldman Sachs' },
  { ticker: 'MS', name: 'Morgan Stanley' },
  { ticker: 'BLK', name: 'BlackRock' },
  { ticker: 'AXP', name: 'American Express' },
  { ticker: 'PNC', name: 'PNC Financial' },
  { ticker: 'USB', name: 'US Bancorp' },
  
  // Payment/Fintech
  { ticker: 'V', name: 'Visa' },
  { ticker: 'MA', name: 'Mastercard' },
  { ticker: 'SQ', name: 'Square' },
  { ticker: 'PYPL', name: 'PayPal' },
  { ticker: 'COF', name: 'Capital One' },
  { ticker: 'DFS', name: 'Discover' },
  
  // Retail/E-commerce
  { ticker: 'WMT', name: 'Walmart' },
  { ticker: 'HD', name: 'Home Depot' },
  { ticker: 'TGT', name: 'Target' },
  { ticker: 'MCD', name: 'McDonald\'s' },
  { ticker: 'SBUX', name: 'Starbucks' },
  { ticker: 'NKE', name: 'Nike' },
  { ticker: 'LULU', name: 'Lululemon' },
  { ticker: 'RH', name: 'RH' },
  { ticker: 'CZR', name: 'Caesars Entertainment' },
  { ticker: 'MGM', name: 'MGM Resorts' },
  { ticker: 'LVS', name: 'Las Vegas Sands' },
  
  // Consumer/Goods
  { ticker: 'PG', name: 'Procter & Gamble' },
  { ticker: 'KO', name: 'Coca-Cola' },
  { ticker: 'PEP', name: 'PepsiCo' },
  { ticker: 'MO', name: 'Altria' },
  { ticker: 'PM', name: 'Philip Morris' },
  { ticker: 'EL', name: 'Estée Lauder' },
  { ticker: 'ULTA', name: 'Ulta Beauty' },
  { ticker: 'CLX', name: 'Clorox' },
  { ticker: 'KMB', name: 'Kimberly-Clark' },
  
  // Healthcare/Pharma
  { ticker: 'JNJ', name: 'Johnson & Johnson' },
  { ticker: 'UNH', name: 'UnitedHealth' },
  { ticker: 'PFE', name: 'Pfizer' },
  { ticker: 'MRK', name: 'Merck' },
  { ticker: 'ABBV', name: 'AbbVie' },
  { ticker: 'LLY', name: 'Eli Lilly' },
  { ticker: 'AMGN', name: 'Amgen' },
  { ticker: 'GILD', name: 'Gilead Sciences' },
  { ticker: 'REGN', name: 'Regeneron' },
  { ticker: 'BNTX', name: 'BioNTech' },
  { ticker: 'CVS', name: 'CVS Health' },
  { ticker: 'WBA', name: 'Walgreens Boots Alliance' },
  { ticker: 'CI', name: 'Cigna' },
  { ticker: 'HUM', name: 'Humana' },
  
  // Transportation
  { ticker: 'BA', name: 'Boeing' },
  { ticker: 'LUV', name: 'Southwest Airlines' },
  { ticker: 'DAL', name: 'Delta Air Lines' },
  { ticker: 'UAL', name: 'United Airlines' },
  { ticker: 'ALK', name: 'Alaska Air' },
  { ticker: 'F', name: 'Ford' },
  { ticker: 'GM', name: 'General Motors' },
  { ticker: 'TM', name: 'Toyota' },
  { ticker: 'HMC', name: 'Honda' },
  { ticker: 'RIG', name: 'Transocean' },
  
  // Energy
  { ticker: 'CVX', name: 'Chevron' },
  { ticker: 'XOM', name: 'ExxonMobil' },
  { ticker: 'MPC', name: 'Marathon Petroleum' },
  { ticker: 'PSX', name: 'Phillips 66' },
  { ticker: 'VLO', name: 'Valero Energy' },
  { ticker: 'EOG', name: 'EOG Resources' },
  { ticker: 'MRO', name: 'Marathon Oil' },
  { ticker: 'OXY', name: 'Occidental Petroleum' },
  { ticker: 'SLB', name: 'Schlumberger' },
  
  // Utilities
  { ticker: 'NEE', name: 'NextEra Energy' },
  { ticker: 'DUK', name: 'Duke Energy' },
  { ticker: 'SO', name: 'Southern Company' },
  { ticker: 'D', name: 'Dominion Energy' },
  { ticker: 'EXC', name: 'Exelon' },
  { ticker: 'AEP', name: 'American Electric Power' },
  { ticker: 'XEL', name: 'Xcel Energy' },
  
  // Telecommunications
  { ticker: 'T', name: 'AT&T' },
  { ticker: 'VZ', name: 'Verizon' },
  { ticker: 'TMUS', name: 'T-Mobile' },
  { ticker: 'CMCSA', name: 'Comcast' },
  { ticker: 'CHTR', name: 'Charter Communications' },
  
  // Industrial/Machinery
  { ticker: 'CAT', name: 'Caterpillar' },
  { ticker: 'DE', name: 'Deere' },
  { ticker: 'GE', name: 'General Electric' },
  { ticker: 'HON', name: 'Honeywell' },
  { ticker: 'ITW', name: 'Illinois Tool Works' },
  { ticker: 'LMT', name: 'Lockheed Martin' },
  { ticker: 'RTX', name: 'Raytheon Technologies' },
  
  // Materials
  { ticker: 'NEM', name: 'Newmont' },
  { ticker: 'SCCO', name: 'Southern Copper' },
  { ticker: 'FCX', name: 'Freeport-McMoRan' },
  { ticker: 'CLF', name: 'Cleveland-Cliffs' },
  { ticker: 'X', name: 'United States Steel' },
  
  // Real Estate/Infrastructure
  { ticker: 'AMT', name: 'American Tower' },
  { ticker: 'CCI', name: 'Crown Castle' },
  { ticker: 'EQIX', name: 'Equinix' },
  { ticker: 'DLR', name: 'Digital Realty' },
  { ticker: 'WELL', name: 'Welltower' },
  { ticker: 'PLD', name: 'Prologis' },
  
  // Food Services
  { ticker: 'YUM', name: 'Yum! Brands' },
  { ticker: 'DCI', name: 'Donaldson' },
  { ticker: 'GIS', name: 'General Mills' },
  { ticker: 'K', name: 'Kellogg' },
  { ticker: 'CPB', name: 'Campbell Soup' }
];


export function SearchableTickerInput({ onSelectTicker, placeholder = "Search by ticker or company name..." }) {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchInput.trim === '') {
      setSuggestions([]);
      return;
    }

    const lowerSearch = searchInput.toLowerCase().trim();
    const filtered = STOCK_DATABASE.filter(stock =>
      stock.ticker.toLowerCase().includes(lowerSearch) ||
      stock.name.toLowerCase().includes(lowerSearch)
    );

    setSuggestions(filtered.slice(0, 8)); // Show up to 8 suggestions
    setShowSuggestions(filtered.length > 0);
  }, [searchInput]);

  const handleSelectStock = (stock) => {
    onSelectTicker(stock.ticker);
    setSearchInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleInputChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleInputFocus = () => {
    if (searchInput.trim() === '') return;
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="searchable-ticker-container">
      <div className="ticker-input-wrapper">
        <input
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="ticker-search-input"
          autoComplete="off"
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {suggestions.map(stock => (
              <div
                key={stock.ticker}
                className="suggestion-item"
                onClick={() => handleSelectStock(stock)}
              >
                <span className="suggestion-ticker">{stock.ticker}</span>
                <span className="suggestion-name">{stock.name}</span>
              </div>
            ))}
          </div>
        )}

        {searchInput && suggestions.length === 0 && searchInput.trim() !== '' && (
          <div className="suggestions-dropdown">
            <div className="no-results">No stocks found</div>
          </div>
        )}
      </div>
    </div>
  );
}
