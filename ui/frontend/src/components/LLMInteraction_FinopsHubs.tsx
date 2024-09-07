import React, { useState, useTransition } from 'react';
import {
  Button, Box, Typography, List, ListItem, ListItemText, Collapse, CircularProgress, Paper, useTheme, Checkbox, Select, MenuItem
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { AnimatedTooltip } from './AnimatedTooltip';
import { SelectChangeEvent } from '@mui/material';  // Import this from MUI

interface Recommendation {
  category: string;
  impact?: string;
  short_description?: { problem: string };
  extended_properties?: Record<string, string>;
  advice?: string;
  subscription_id?: string;
  source?: string;
  SubscriptionGuid?: string; 
  Instance?: string;
  generated_date?: string;
  fit_score?: string;
}

const LLMInteraction_FinopsHubs: React.FC = () => {
  const theme = useTheme();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isResultsExpanded, setIsResultsExpanded] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [filterSource, setFilterSource] = useState(''); // Filter state

  const getSubscriptionId = (rec: Recommendation) => {
    if (rec.source === 'Azure API') {
      return rec.extended_properties?.subid || rec.subscription_id || 'N/A';
    }
    return rec.subscription_id || 'N/A';
  };

  const handleFilterChange = (event: SelectChangeEvent) => {
    setFilterSource(event.target.value);
  };

  const handleFetchRecommendations = async () => {
    startTransition(() => {
      setIsLoading(true);
      setRecommendations([]);
      setError(null);
    });

    try {
      const res = await axios.get<Recommendation[]>(`http://localhost:5000/api/review-recommendations`);

      if (res.data.length === 0) {
        setError('No recommendations available.');
      } else {
        setRecommendations(res.data);
      }
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to fetch recommendations. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToLLM = async () => {
    startTransition(() => {
      setIsLoading(true);
      setError(null);
    });

    try {
      const recommendationsToSend = recommendations.filter((_, index) =>
        selectedRecommendations.has(index)
      );

      const res = await axios.post<{ advice: Recommendation[] }>(
        'http://localhost:5000/api/analyze-recommendations',
        { recommendations: recommendationsToSend },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      setRecommendations(res.data.advice);
    } catch (error: any) {
      console.error('Error querying AI Assistant:', error);
      setError('Failed to query the AI Assistant. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleResultsToggle = () => {
    setIsResultsExpanded(!isResultsExpanded);
  };

  const handleSelectRecommendation = (index: number) => {
    const newSelectedRecommendations = new Set(selectedRecommendations);
    if (selectedRecommendations.has(index)) {
      newSelectedRecommendations.delete(index);
    } else {
      newSelectedRecommendations.add(index);
    }
    setSelectedRecommendations(newSelectedRecommendations);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecommendations(new Set());
    } else {
      const allSelected = new Set(recommendations.map((_, index) => index));
      setSelectedRecommendations(allSelected);
    }
    setSelectAll(!selectAll);
  };

  const renderFormattedAdvice = (advice: string) => {
    const lines = advice.split('\n').map((line, index) => {
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <Typography key={index} variant="body2">
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </Typography>
        );
      }

      if (line.trim().startsWith('- ')) {
        return (
          <Typography key={index} variant="body2" component="li" style={{ marginLeft: '20px' }}>
            {line.trim().slice(2)}
          </Typography>
        );
      }

      return (
        <Typography key={index} variant="body2">
          {line}
        </Typography>
      );
    });

    return <>{lines}</>;
  };

  const renderSqlDbProperties = (rec: Recommendation) => {
    return (
      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Additional SQL DB Information:
        </Typography>
        <Typography variant="body2">
          <strong>Instance Name:</strong> {rec.Instance || 'N/A'}
        </Typography>
        <Typography variant="body2">
          <strong>Generated Date:</strong> {rec.generated_date || 'N/A'}
        </Typography>
        <Typography variant="body2">
          <strong>Fit Score:</strong> {rec.fit_score || 'N/A'}
        </Typography>
        <Typography variant="body2">
          <strong>Subscription ID:</strong> {rec.subscription_id || 'N/A'}
        </Typography>
      </Box>
    );
  };

  const renderExtendedProperties = (rec: Recommendation) => {
    if (rec.source === 'SQL DB') {
      return renderSqlDbProperties(rec);
    } else if (rec.extended_properties) {
      return (
        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Extended Properties:
          </Typography>
          {Object.entries(rec.extended_properties).map(([key, value]) => (
            <Typography key={key} variant="body2">
              <strong>{key}:</strong> {value}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  const filteredRecommendations = filterSource
    ? recommendations.filter((rec) => rec.source === filterSource)
    : recommendations;

  return (
    <Box p={2} m={2} border={1} borderRadius={2} borderColor={theme.palette.mode === 'light' ? 'grey.300' : 'grey.700'}>
      <Typography variant="h5" gutterBottom>
        AI Assistant Assessment
      </Typography>

      {error && (
        <Typography variant="body1" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Button
        variant="contained"
        color="primary"
        onClick={handleFetchRecommendations}
        disabled={isLoading || isPending}
        sx={{ mb: 4 }}
      >
        {isLoading ? <CircularProgress size={24} /> : 'Fetch Recommendations for Review'}
      </Button>

      {recommendations.length > 0 && (
        <>
          {/* Filter and Select All options */}
          <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
            {/* Source filter */}
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
              <Select
                value={filterSource}
                onChange={handleFilterChange}
                displayEmpty
                sx={{ minWidth: '240px' }} // Matches the width of "Fetch Recommendations" button
              >
                <MenuItem value="">
                  <em>All Sources</em>
                </MenuItem>
                <MenuItem value="Azure API">Azure API</MenuItem>
                <MenuItem value="SQL DB">SQL DB</MenuItem>
              </Select>
            </Box>

            <Box display="flex" alignItems="center">
              <Checkbox
                checked={selectAll}
                onChange={handleSelectAll}
                inputProps={{ 'aria-label': 'select all' }}
              />
              <Typography>Select All</Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSendToLLM}
            disabled={isLoading || selectedRecommendations.size === 0}
            sx={{ mb: 4, ml: 2 }}
          >
            {isLoading ? <CircularProgress size={24} /> : `Send to LLM for Analysis (${selectedRecommendations.size})`}
          </Button>

          <Box mt={2} display="flex" alignItems="center" justifyContent="space-between" mb={2} onClick={handleResultsToggle} sx={{ cursor: 'pointer' }}>
            <AnimatedTooltip title="Click to expand/collapse the results">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Assessment Results</Typography>
                {isResultsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
            </AnimatedTooltip>
          </Box>

          <Collapse in={isResultsExpanded} timeout="auto" unmountOnExit>
            <List>
              {filteredRecommendations.map((rec, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    button
                    onClick={() => handleToggleExpand(index)}
                    sx={{ bgcolor: expandedIndex === index ? 'grey.100' : 'inherit', mb: 2, borderRadius: 1 }}
                  >
                    <Checkbox
                      checked={selectedRecommendations.has(index)}
                      onChange={() => handleSelectRecommendation(index)}
                      sx={{ mr: 2 }}
                      inputProps={{ 'aria-label': `select recommendation ${index}` }}
                    />
                    <ListItemText
                      primary={
                        <>
                          <Typography variant="body1">
                            <strong>Subscription:</strong> {getSubscriptionId(rec)} - <strong>Recommendation {index + 1}:</strong> {rec.category || 'N/A'}
                            <strong> Source:</strong> {rec.source || 'N/A'}
                          </Typography>
                        </>
                      }
                      secondary={
                        <>
                          <Typography variant="body2">
                            <strong>Impact:</strong> {rec.impact || 'Unknown'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Problem:</strong> {rec.short_description?.problem || 'No problem description available'}
                          </Typography>
                        </>
                      }
                    />
                    {expandedIndex === index ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItem>
                  <Collapse in={expandedIndex === index} timeout="auto" unmountOnExit>
                    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                      <Typography variant="body2">
                        <strong>AI Advice:</strong>
                      </Typography>
                      <Box ml={2}>
                        {renderFormattedAdvice(rec.advice || 'No advice available')}
                      </Box>
                      {renderExtendedProperties(rec)}
                    </Paper>
                  </Collapse>
                </React.Fragment>
              ))}
            </List>
          </Collapse>
        </>
      )}
    </Box>
  );
};

export default LLMInteraction_FinopsHubs;
