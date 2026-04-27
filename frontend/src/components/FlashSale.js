import React, { useState, useEffect, useCallback } from 'react';
import { flashSaleAPI } from '../services/api';

const FlashSale = () => {
  // State management
  const [saleStatus, setSaleStatus] = useState(null);
  const [userId, setUserId] = useState('');
  const [userPurchase, setUserPurchase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch sale status
  const fetchSaleStatus = useCallback(async () => {
    if (purchasing) return; // Don't refresh while purchasing
    
    try {
      setLoading(true);
      const response = await flashSaleAPI.getSaleStatus();
      if (response.success) {
        setSaleStatus(response.data);
        updateCountdown(response.data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [purchasing]);

  // Update countdown timer
  const updateCountdown = (status) => {
    if (!status) return;

    const now = new Date();
    let targetTime;

    if (status.status === 'upcoming') {
      targetTime = new Date(status.startTime);
    } else if (status.status === 'active') {
      targetTime = new Date(status.endTime);
    } else {
      setCountdown(null);
      return;
    }

    const timeDiff = targetTime - now;
    if (timeDiff > 0) {
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
      
      setCountdown({ hours, minutes, seconds });
    } else {
      setCountdown(null);
      // Refresh status when time expires
      setTimeout(fetchSaleStatus, 1000);
    }
  };

  // Check user purchase status
  const checkUserPurchase = async (uid) => {
    if (!uid) {
      setUserPurchase(null);
      return;
    }

    try {
      const response = await flashSaleAPI.getUserPurchase(uid);
      if (response.success) {
        setUserPurchase(response.data.purchase);
      }
    } catch (error) {
      console.error('Error checking user purchase:', error);
    }
  };

  // Handle purchase attempt
  const handlePurchase = async () => {
    if (!userId.trim()) {
      setMessage({ type: 'error', text: 'Please enter your user ID' });
      return;
    }

    setPurchasing(true);
    setMessage(null);

    try {
      const response = await flashSaleAPI.attemptPurchase(userId.trim());
      
      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: response.message,
          purchase: response.data.purchase
        });
        setUserPurchase(response.data.purchase);
        // Refresh sale status after successful purchase
        setTimeout(fetchSaleStatus, 1000);
      } else {
        setMessage({ 
          type: 'error', 
          text: response.message 
        });
        if (response.data && response.data.purchase) {
          setUserPurchase(response.data.purchase);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPurchasing(false);
    }
  };

  // Reset demo data (development only)
  const handleReset = async () => {
    try {
      setLoading(true);
      const response = await flashSaleAPI.resetSaleData();
      if (response.success) {
        setMessage({ type: 'info', text: 'Sale data reset successfully' });
        setUserPurchase(null);
        await fetchSaleStatus();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Effect for initial load
  useEffect(() => {
    fetchSaleStatus();
  }, [fetchSaleStatus]);

  // Effect for auto-refresh
  useEffect(() => {
    if (!autoRefresh || purchasing) return;

    const interval = setInterval(() => {
      fetchSaleStatus();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, purchasing, fetchSaleStatus]);

  // Effect for countdown timer
  useEffect(() => {
    if (!countdown) return;

    const timer = setInterval(() => {
      if (saleStatus) {
        updateCountdown(saleStatus);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, saleStatus]);

  // Effect for checking user purchase when userId changes
  useEffect(() => {
    if (userId.trim()) {
      const timer = setTimeout(() => {
        checkUserPurchase(userId.trim());
      }, 500); // Debounce
      
      return () => clearTimeout(timer);
    } else {
      setUserPurchase(null);
    }
  }, [userId]);

  // Helper functions
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'upcoming': return 'status-upcoming';
      case 'ended': return 'status-ended';
      case 'sold-out': return 'status-sold-out';
      default: return '';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '🔥 Sale Active';
      case 'upcoming': return '⏰ Coming Soon';
      case 'ended': return '❌ Sale Ended';
      case 'sold-out': return '🚫 Sold Out';
      default: return 'Unknown';
    }
  };

  const canPurchase = () => {
    return saleStatus && 
           saleStatus.status === 'active' && 
           saleStatus.currentStock > 0 && 
           !userPurchase &&
           userId.trim() &&
           !purchasing;
  };

  if (loading && !saleStatus) {
    return (
      <div className="flash-sale-container">
        <div className="loading-spinner"></div>
        <p>Loading flash sale data...</p>
      </div>
    );
  }

  return (
    <div className="flash-sale-container">
      {/* Sale Status */}
      {saleStatus && (
        <div className="sale-status">
          <div className={`status-badge ${getStatusBadgeClass(saleStatus.status)}`}>
            {getStatusText(saleStatus.status)}
          </div>
          
          {countdown && (
            <div className="countdown">
              <div className="countdown-item">
                <span className="countdown-number">{countdown.hours.toString().padStart(2, '0')}</span>
                <span className="countdown-label">Hours</span>
              </div>
              <div className="countdown-item">
                <span className="countdown-number">{countdown.minutes.toString().padStart(2, '0')}</span>
                <span className="countdown-label">Minutes</span>
              </div>
              <div className="countdown-item">
                <span className="countdown-number">{countdown.seconds.toString().padStart(2, '0')}</span>
                <span className="countdown-label">Seconds</span>
              </div>
            </div>
          )}

          <button 
            onClick={fetchSaleStatus}
            className="refresh-button"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Product Information */}
      {saleStatus && (
        <div className="product-info">
          <div className="product-name">{saleStatus.product.name}</div>
          <div className="product-price">${saleStatus.product.price}</div>
          
          <div className="stock-info">
            <span>Available: {saleStatus.currentStock}</span>
            <span>Sold: {saleStatus.soldCount}</span>
          </div>
          
          <div className="stock-bar">
            <div 
              className="stock-progress"
              style={{ 
                width: `${(saleStatus.currentStock / saleStatus.totalStock) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          {message.purchase && (
            <div className="purchase-success">
              <h3>🎉 Purchase Successful!</h3>
              <div className="purchase-id">
                Purchase ID: {message.purchase.id}
              </div>
              <p>Thank you for your purchase!</p>
            </div>
          )}
        </div>
      )}

      {/* User Purchase Status */}
      {userPurchase && (
        <div className="purchase-success">
          <h3>✅ You have already purchased this item</h3>
          <div className="purchase-id">
            Purchase ID: {userPurchase.id}
          </div>
          <p>Purchased on: {new Date(userPurchase.timestamp).toLocaleString()}</p>
        </div>
      )}

      {/* Purchase Form */}
      {!userPurchase && (
        <div className="purchase-form">
          <div className="form-group">
            <label htmlFor="userId">User ID / Email:</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID or email"
              disabled={purchasing}
            />
          </div>
          
          <button
            onClick={handlePurchase}
            disabled={!canPurchase()}
            className={`buy-button ${purchasing ? 'loading' : ''}`}
          >
            {purchasing ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              'Buy Now'
            )}
          </button>
        </div>
      )}

      {/* Development Controls */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
          <h4>Development Controls</h4>
          <button onClick={handleReset} disabled={loading}>
            Reset Sale Data
          </button>
          <label style={{ marginLeft: '1rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
      )}
    </div>
  );
};

export default FlashSale;