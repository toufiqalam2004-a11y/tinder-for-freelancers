import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Input from '../components/Input';
import Button from '../components/Button';
import { useSources } from '../contexts/SourcesContext';
import { isValidFacebookGroupUrl, extractGroupName } from '../utils/validators';

const AddFacebookGroup = () => {
  const navigate = useNavigate();
  const { addSource } = useSources();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a Facebook group URL');
      return;
    }
    
    if (!isValidFacebookGroupUrl(url)) {
      setError('Please enter a valid Facebook Group URL.');
      return;
    }

    setError('');
    setLoading(true);
    
    setTimeout(() => {
      addSource({
        platform: 'facebook_group',
        groupName: extractGroupName(url),
        groupUrl: url.trim(),
      });
      toast.success('Facebook group added successfully.');
      navigate('/sources');
    }, 500);
  };

  return (
    <PageTransition>
      <div className="px-6 py-6 pb-24 max-w-md mx-auto">
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Add Facebook Group</h1>
            <p className="text-text-secondary text-sm mt-1">Paste the link of a public Facebook group.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-card p-4">
          <Facebook className="text-[#1877F2]" size={24} />
          <p className="text-sm text-text-secondary">Only public groups are supported</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <Input
            label="Facebook Group URL"
            placeholder="https://www.facebook.com/groups/example"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={error}
          />

          <div className="mt-4">
            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Add Group
            </Button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
};

export default AddFacebookGroup;
