import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useProfile } from '../contexts/ProfileContext';
import { createJob } from '../data/models';
import { addJob } from '../data/storage';
import { calculateProfileMatch, extractJobAttributes } from '../services/jobClassifier';
import { isValidUrl } from '../utils/validators';

const ManualImport = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    company: '',
    description: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('Title and description are required');
      return;
    }

    if (formData.url && !isValidUrl(formData.url)) {
      toast.error('Please enter a valid HTTP or HTTPS job post URL');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Analyze text using classifier
      const extractedAttrs = extractJobAttributes(formData.description, 'manual_import', formData.company, profile);
      const matchResult = calculateProfileMatch(formData.description, extractedAttrs, profile);

      const newJob = createJob({
        title: formData.title,
        company: formData.company || 'Direct Client',
        description: formData.description,
        sourceUrl: formData.url,
        postUrl: formData.url,
        platform: 'manual_import',
        isDemo: false,
        matchScore: matchResult.matchScore,
        matchReasons: matchResult.reasons,
        requiredSkills: extractedAttrs.requiredSkills || [],
        jobType: extractedAttrs.jobType || 'freelance',
        remote: extractedAttrs.remote !== undefined ? extractedAttrs.remote : true,
        salary: extractedAttrs.salary || 'Negotiable',
      });

      addJob(newJob);
      toast.success('Job imported successfully!');
      navigate('/jobs');
      
    } catch (error) {
      console.error('Error importing job:', error);
      toast.error('Failed to import job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-5 py-6 pb-28">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={24} className="mr-1" />
            <span>Back</span>
          </button>
        </div>

        {/* Title Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Import Job Manually</h1>
          <p className="text-text-secondary mt-1">Found a job post? Add it to your feed.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="p-5 mb-8 space-y-4">
            <Input
              label="Job/Post URL (Optional)"
              name="url"
              value={formData.url}
              onChange={handleChange}
              placeholder="https://..."
            />
            
            <Input
              label="Job Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Video Editor Needed"
              required
            />
            
            <Input
              label="Company/Client (Optional)"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="e.g. Creative Studio"
            />
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Description <span className="text-text-muted">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                className="w-full bg-surface border border-border rounded-xl p-3 text-sm text-text-primary focus:outline-none focus:border-primary resize-none placeholder-text-muted transition-colors"
                placeholder="Paste the job description..."
                required
              />
            </div>
          </Card>

          <Button 
            type="submit" 
            variant="primary" 
            fullWidth 
            loading={isSubmitting}
            className="text-white py-3.5"
          >
            Add to Job Feed
          </Button>
        </form>
      </div>
    </PageTransition>
  );
};

export default ManualImport;
