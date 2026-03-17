import React from 'react';
import { Box } from 'lucide-react';
import AssetCard from './AssetCard';

const AssetGrid = ({ assets, loading, onAssetClick, sentinelRef, searchQuery }) => {
  return (
    <div id="asset-grid">
      {assets.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Box size={48} /></div>
          <div className="empty-state-title">No assets found</div>
          <div className="empty-state-text">
            {searchQuery ? 'Try a different search term' : 'Add your first asset to get started'}
          </div>
        </div>
      ) : (
        assets.map(asset => (
          <AssetCard 
            key={asset.id} 
            asset={asset} 
            onClick={onAssetClick} 
          />
        ))
      )}

      {loading && (
        <div className="loading-row">
          <div className="loading-spinner"></div>
          <span>Loading more assets...</span>
        </div>
      )}

      <div ref={sentinelRef} style={{ height: '20px', width: '100%' }} />
    </div>
  );
};

export default AssetGrid;
