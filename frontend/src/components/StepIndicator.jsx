import { Check } from 'lucide-react';

const StepIndicator = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-center gap-0 w-full px-4 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index + 1 < currentStep;
        const isActive = index + 1 === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300
              ${isCompleted ? 'bg-success text-white' : ''}
              ${isActive ? 'bg-primary text-dark ring-4 ring-primary/20' : ''}
              ${!isCompleted && !isActive ? 'bg-gray-200 text-text-muted' : ''}
            `}>
              {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            {/* Line */}
            {!isLast && (
              <div className={`h-0.5 flex-1 mx-1 transition-colors duration-300 ${isCompleted ? 'bg-success' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
