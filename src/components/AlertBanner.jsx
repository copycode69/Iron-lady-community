function AlertBanner() {
  const calculateTimeLeft = () => {
    const targetDate = new Date('2024-01-19');
    const now = new Date();
    const difference = targetDate - now;

    if (difference > 0) {
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      return `${days}d : ${hours}h : ${minutes}m`;
    }
    return '0d : 0h : 0m';
  };

  return (
    <div className="alert-banner">
      <div className="alert-text">
        Upgrade now to prevent losing access on January 19. Expiring in {calculateTimeLeft()}
      </div>
      <button className="upgrade-btn">Upgrade now</button>
    </div>
  );
}

export default AlertBanner;

