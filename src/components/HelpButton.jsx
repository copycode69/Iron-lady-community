import { FiMessageCircle } from 'react-icons/fi';

function HelpButton() {
  return (
    <button className="help-button">
      <FiMessageCircle />
      <span>Need help?</span>
    </button>
  );
}

export default HelpButton;

