import { Footprints } from 'lucide-react';
import { motion } from 'framer-motion';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary via-primary/90 to-secondary flex items-center justify-center z-50">
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <Footprints className="w-16 h-16 text-white" />
        </motion.div>
        
        <div className="flex flex-col items-center gap-2">
          <motion.div 
            className="w-16 h-1 bg-white/30 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div 
              className="h-full bg-white rounded-full"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          
          <motion.p 
            className="text-white text-lg font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Chargement de FitPaS...
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};
