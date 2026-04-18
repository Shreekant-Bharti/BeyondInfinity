const DryRunHistory = require('../models/DryRunHistory');
const { Parser } = require('json2csv');

exports.saveDryRunHistory = async (req, res) => {
  try {
    const { tankId, title, fault, message, deletedBy, deletedRole, repairDetails, repairCost, billImage } = req.body;
    
    const resolvedAt = new Date();
    const month = resolvedAt.getMonth() + 1;
    const year = resolvedAt.getFullYear();

    const newEntry = new DryRunHistory({
      tankId, title, fault, message, deletedBy, deletedRole,
      repairDetails, repairCost, billImage, resolvedAt, month, year
    });

    await newEntry.save();
    res.status(201).json({ success: true, message: 'DRY RUN history saved successfully.' });
  } catch (error) {
    console.error('Error saving DRY RUN history:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const { month, year, all } = req.query;
    let query = {};
    if (!all) {
      if (month) query.month = parseInt(month, 10);
      if (year) query.year = parseInt(year, 10);
    }
    
    const records = await DryRunHistory.find(query).sort({ resolvedAt: -1 });
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching DRY RUN reports:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

exports.downloadDryRunReport = async (req, res) => {
  try {
    const { month, year, all } = req.query;
    let query = {};
    if (!all && (month || year)) {
      if (month) query.month = parseInt(month, 10);
      if (year) query.year = parseInt(year, 10);
    }

    const records = await DryRunHistory.find(query).sort({ resolvedAt: -1 });

    const fields = [
        { label: 'Tank ID', value: 'tankId' },
        { label: 'Title', value: 'title' },
        { label: 'Fault', value: 'fault' },
        { label: 'Message', value: 'message' },
        { label: 'Deleted By', value: 'deletedBy' },
        { label: 'Role', value: 'deletedRole' },
        { label: 'Repair Details', value: 'repairDetails' },
        { label: 'Repair Cost', value: 'repairCost' },
        { label: 'Date', value: 'resolvedAt' }
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records.length ? records : [{}]); 

    res.header('Content-Type', 'text/csv');
    res.attachment(`dryrun-report-${month || 'all'}-${year || 'time'}.csv`);
    return res.send(csv);

  } catch (error) {
    console.error('Error downloading DRY RUN report:', error);
    res.status(500).json({ success: false, error: 'Report generation failed' });
  }
};