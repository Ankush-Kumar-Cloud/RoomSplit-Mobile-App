const Group = require('../models/Group');

const genCode  = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const populate = q => q.populate('owner', 'name email').populate('members', 'name email');

// ── isMember: works on both lean objects and Mongoose docs ─────────────────
const isMember = (group, uid) =>
  (group.members || []).some(m => (m._id || m).toString() === uid.toString());

// ── POST Create Group ──────────────────────────────────────────────────────
exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Group name required' });

    let inviteCode, exists = true;
    while (exists) { inviteCode = genCode(); exists = await Group.exists({ inviteCode }); }

    const group = await Group.create({ name: name.trim(), owner: req.user._id, members: [req.user._id], inviteCode });
    res.status(201).json(await populate(Group.findById(group._id)).lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── GET My Groups ──────────────────────────────────────────────────────────
// Uses the { members: 1 } index for a fast lookup.
exports.getMyGroups = async (req, res) => {
  try {
    res.json(await populate(Group.find({ members: req.user._id }).sort({ createdAt: -1 })).lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── GET Single Group ────────────────────────────────────────────────────────
exports.getGroup = async (req, res) => {
  try {
    const group = await populate(Group.findById(req.params.id)).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ message: 'Not a member' });
    res.json(group);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── POST Join Group ─────────────────────────────────────────────────────────
exports.joinGroup = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    // $addToSet atomically adds the user to members only if not already present
    const group = await Group.findOneAndUpdate(
      { inviteCode: inviteCode?.trim().toUpperCase() },
      { $addToSet: { members: req.user._id } },
      { new: true }
    );
    if (!group) return res.status(404).json({ message: 'Group not found — check the code' });
    res.json(await populate(Group.findById(group._id)).lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── PUT Rename Group ────────────────────────────────────────────────────────
exports.updateGroup = async (req, res) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name required' });
    const group = await Group.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id }, // Atomic ownership check
      { name: req.body.name.trim() },
      { new: true }
    );
    if (!group) return res.status(404).json({ message: 'Group not found or not authorized' });
    res.json(await populate(Group.findById(group._id)).lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── DELETE Leave Group ──────────────────────────────────────────────────────
exports.leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const uid = req.user._id.toString();
    group.members = group.members.filter(m => m.toString() !== uid);
    if (!group.members.length) { await group.deleteOne(); return res.json({ message: 'Group deleted' }); }
    if (group.owner.toString() === uid) group.owner = group.members[0];
    await group.save();
    res.json({ message: 'Left group' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
