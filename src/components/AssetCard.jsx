import React from 'react';

const AssetCard = ({ asset, onClick }) => {
  return (
    <div
      className="asset-card"
      onClick={() => onClick(asset)}
    >
      <img
        src={asset.thumbnail_url || 'https://sampleimg.com/300x300?text=No+Image'}
        className={`card-thumb ${asset.nsfw ? 'nsfw-blur' : ''}`}
        alt={asset.name}
      />
      <div className="card-info">
        <span className="category">{asset.category}</span>
        <h3>{asset.name}</h3>
      </div>
    </div>
  );
};

export default AssetCard;
