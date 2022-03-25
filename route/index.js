const userManager = require('../manageUser');
const assembleManager = require('../manageAssemble');
const audioManager = require('../manageAudio');
const voiceNoteManager = require('../manageVoiceNote');
const viewerManager = require('../manageViewer');
const clubManager = require('../manageClub');
const clubTierManager = require('../manageClubTier');
const emailTemplateManager = require('../manageEmailTemplate');
const groupManager = require('../manageGroup');
const aCodeManager = require('../manageACode');
const vCodeManager = require('../manageVCode');
const agoraManager = require('../manageAgora');
const verifyToken = require('../utils/verifytoken');
const assembleManage = require('../manageAssemble');
const eventManager = require('../manageEvent');
const stripeManage = require('../manageStripe');
const referralManage = require('../manageReferral');

module.exports = function (app) {
    app.get('/health', userManager.health);
    app.get('/healthnoti', userManager.healthNotification);
    app.post('/api/auth/signup', userManager.createuser); // sign
    app.patch(
        '/api/auth/update',
        verifyToken.verifyUserToken,
        userManager.updateuser
    ); // backend api
    app.patch('/api/auth/updatepass/:user_id', userManager.updateuserpass); // backend api
    app.post('/api/auth/login', userManager.login);
    app.post('/api/auth/forgotpass', userManager.forgotpass);
    app.post('/api/auth/confirmcodepass', userManager.confirmCodePass);

    // app.get('/api/auth/confirm', userManager.confirmUser); // parameter api_token
    /// get user by id
    app.get(
        '/api/user/:user_id',
        verifyToken.verifyUserToken,
        userManager.getuser
    ); // parameter id
    app.delete(
        '/api/user/:user_id',
        verifyToken.verifyUserToken,
        userManager.deleteUser
    ); // parameter id
    /// get all users
    app.get('/api/users', verifyToken.verifyUserToken, userManager.getallusers);
    /// add userid
    app.post(
        '/api/connect/user',
        verifyToken.verifyUserToken,
        userManager.connectUserid
    );
    app.delete(
        '/api/connect/user/:opposite_id/:club_id',
        verifyToken.verifyUserToken,
        userManager.delConnectUserid
    );
    app.get(
        '/api/connect/user/:opposite_id/:club_id',
        verifyToken.verifyUserToken,
        userManager.getConnectByUserId
    );
    app.get(
        '/api/connect/users/:user_id/:club_id',
        verifyToken.verifyUserToken,
        userManager.getConnectsByUserId
    );
    app.get(
        '/api/connect/users/opposite/:opposite_id/:club_id',
        verifyToken.verifyUserToken,
        userManager.getUsersByOpoositeId
    );
    app.get(
        '/api/user/like/:opposite_id',
        verifyToken.verifyUserToken,
        userManager.getLikeGained
    );
    app.post(
        '/api/user/like',
        verifyToken.verifyUserToken,
        userManager.createLikeGained
    );

    /// Assemble api lists ///
    /// ///////////////////////
    app.get(
        '/api/assembles',
        verifyToken.verifyUserToken,
        assembleManager.getassembles
    );
    app.post(
        '/api/assemble',
        verifyToken.verifyUserToken,
        assembleManager.createassemble
    );
    app.post(
        '/api/assemble/mobile',
        verifyToken.verifyUserToken,
        assembleManager.createassemble
    );
    app.post(
        '/api/assemble/like',
        verifyToken.verifyUserToken,
        assembleManager.createLikeGained
    );
    app.get(
        '/api/assemble/like/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.getLikeGained
    );
    app.patch(
        '/api/assemble/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.updateassemble
    );
    app.patch(
        '/api/notify/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.notifyassemble
    );
    app.delete(
        '/api/assemble/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.deleteassemble
    );
    app.get(
        '/api/assemble/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.getassemble
    );
    app.delete(
        '/api/endassemble/:assemble_id',
        verifyToken.verifyUserToken,
        assembleManager.endAssembly
    );
    /// Audio api lists ///
    /// ///////////////////////
    app.get('/api/audios', verifyToken.verifyUserToken, audioManager.getAudios);
    app.post(
        '/api/audio',
        verifyToken.verifyUserToken,
        audioManager.createAudio
    );
    app.post(
        '/api/audio/mobile',
        verifyToken.verifyUserToken,
        audioManager.createAudio
    );
    app.post(
        '/api/audio/like',
        verifyToken.verifyUserToken,
        audioManager.createLikeGained
    );
    app.get(
        '/api/audio/like/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.getLikeGained
    );
    app.patch(
        '/api/audio/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.updateAudio
    );
    app.delete(
        '/api/audio/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.deleteAudio
    );
    app.get(
        '/api/audio/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.getAudio
    );
    /// Audio Indexing
    app.get(
        '/api/audio/indexing/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.getAudioIndexing
    );
    /// Audio Track
    app.post(
        '/api/audio/track',
        verifyToken.verifyUserToken,
        audioManager.createRecordTrack
    );
    app.get(
        '/api/audio/track/:audio_id',
        verifyToken.verifyUserToken,
        audioManager.getRecordTrack
    );

    /// Voice note manager
    app.get(
        '/api/voicenotes',
        verifyToken.verifyUserToken,
        voiceNoteManager.getVoiceNotes
    );
    app.post(
        '/api/voicenote',
        verifyToken.verifyUserToken,
        voiceNoteManager.createVoiceNote
    );
    app.get(
        '/api/voicenote/:receiver_id/:voicenote_id',
        verifyToken.verifyUserToken,
        voiceNoteManager.getVoiceNote
    );
    app.patch(
        '/api/voicenote/:receiver_id/:voicenote_id',
        verifyToken.verifyUserToken,
        voiceNoteManager.updateVoiceNote
    );
    app.delete(
        '/api/voicenote/:receiver_id/:voicenote_id',
        verifyToken.verifyUserToken,
        voiceNoteManager.deleteVoiceNote
    );

    /// Club api lists ///
    app.get(
        '/api/list/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getListByClubId
    );
    /// ///////////////////////
    app.get('/api/clubs', verifyToken.verifyUserToken, clubManager.getclubs);
    app.post('/api/club', verifyToken.verifyUserToken, clubManager.createclub);
    app.patch(
        '/api/club/:club_id',
        verifyToken.verifyUserToken,
        clubManager.updateclub
    );
    app.delete(
        '/api/club/:club_id',
        verifyToken.verifyUserToken,
        clubManager.deleteclub
    );
    app.get(
        '/api/club/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getclub
    );
    app.get(
        '/api/clubreq/request',
        verifyToken.verifyUserToken,
        clubManager.getClubRequest
    );
    app.post(
        '/api/clubreq/request',
        verifyToken.verifyUserToken,
        clubManager.requestClub
    );
    app.patch(
        '/api/clubreq/request',
        verifyToken.verifyUserToken,
        clubManager.approveClubRequest
    );
    /// add userid
    app.post('/api/club/connect/user', clubManager.connectUserid);
    app.delete(
        '/api/club/connect/user/:club_id/:userid',
        clubManager.deleteConnectUserid
    );
    app.get(
        '/api/club/managers/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getManagersByClubId
    );

    app.get(
        '/api/club/connect/users/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getUsersByClubId
    );
    app.get(
        '/api/club/connect/clubs/user/:user_id',
        verifyToken.verifyUserToken,
        clubManager.getClubsByUserId
    );

    app.get(
        '/api/club/recorder/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getclub_recorder
    );
    app.post(
        '/api/club/recorder',
        verifyToken.verifyUserToken,
        clubManager.createclub_recorder
    );

    /// get Club Room images
    app.get(
        '/api/club-room/images/:club_id',
        verifyToken.verifyUserToken,
        clubManager.getClubRoomImages
    );

    /// Viewer api lists ///
    /// ///////////////////////
    app.get(
        '/api/viewers',
        verifyToken.verifyUserToken,
        viewerManager.getviewers
    );
    app.post(
        '/api/viewer',
        verifyToken.verifyUserToken,
        viewerManager.createviewer
    );
    app.patch(
        '/api/viewer/:viewer_id',
        verifyToken.verifyUserToken,
        viewerManager.updateviewer
    );
    app.delete(
        '/api/viewer/:viewer_id',
        verifyToken.verifyUserToken,
        viewerManager.deleteviewer
    );
    app.get(
        '/api/viewer/:viewer_id',
        verifyToken.verifyUserToken,
        viewerManager.getviewer
    );
    app.get(
        '/api/viewers/channel/:channel_id',
        verifyToken.verifyUserToken,
        viewerManager.getViewersByChannel
    );

    // Activation Code Apis////
    app.get('/api/acodes', aCodeManager.getACodes);
    app.post('/api/acode', aCodeManager.createACode);
    app.patch('/api/acode/:code', aCodeManager.updateACode);
    app.delete('/api/acode/:code', aCodeManager.deleteACode);
    app.get('/api/acode/:code', aCodeManager.getACode);

    /// Verification Code Apis ///
    app.post('/api/vcode', vCodeManager.createVCode);
    app.get('/api/vcode/:code', vCodeManager.getVCode);
    app.patch('/api/vcode/:phone', vCodeManager.updateVCode);
    app.get('/vcode/confirm/:ecode', vCodeManager.confirmCode);

    // get Tutor audio
    app.get(
        '/api/tutoraudio',
        verifyToken.verifyUserToken,
        audioManager.getTutorAudio
    );

    /// Get Agora Token ///
    app.get(
        '/api/agora/:channel_id',
        verifyToken.verifyUserToken,
        agoraManager.getAgoraToken
    );

    /// user Stripe

    app.post('/api/stripe/subscribeItem', stripeManage.subscribeItem);
    app.get(
        '/api/stripe/customer/:userId',
        verifyToken.verifyUserToken,
        stripeManage.getStripeCustomer
    );
    app.delete(
        '/api/stripe/subscribeItem/:userid/:price',
        stripeManage.cancelSubscribeItem
    );

    app.get(
        '/api/events',
        verifyToken.verifyUserToken,
        eventManager.getEvents
    );
    app.patch(
        '/api/event/update/:event_id',
        verifyToken.verifyUserToken,
        eventManager.updateEvent
    );
    app.get(
        '/api/event/:event_id',
        verifyToken.verifyUserToken,
        eventManager.getEvent
    );
    app.patch(
        '/api/notify/event/:event_id',
        verifyToken.verifyUserToken,
        eventManager.notifyEvent
    );

    app.delete(
        '/api/event/:event_id',
        verifyToken.verifyUserToken,
        eventManager.deleteEvent
    );
    app.delete(
        '/api/endevent/:event_id',
        verifyToken.verifyUserToken,
        eventManager.endEvent
    );

    /// ///////// Admin Api Lists /////////
    /// //////////////////////////////////
    /// Admin Auth ///
    app.post('/admin/api/auth/login', userManager.adminlogin);
    app.post('/admin/api/auth/forgotpass', userManager.forgotpass);
    app.post('/admin/api/auth/confirmcodepass', userManager.confirmCodePass);
    app.patch('/admin/api/auth/updatepass/:user_id', userManager.updateuserpass);
    app.post('/admin/api/auth/signup', userManager.adminsignup);
    app.patch('/admin/api/auth/updateUser', userManager.updateuser); // backend api
    app.post('/admin/api/auth/stripe/customer', stripeManage.createCustomer);
    app.post('/admin/api/auth/stripe/subscribe', stripeManage.subScribe);
    app.get('/admin/api/auth/getusers', userManager.getallusers);
    app.post(
        '/admin/api/auth/stripe/subscribewithcoupon',
        stripeManage.subscribeWithCoupon
    );
    app.post('/admin/api/auth/sendEmailCode', vCodeManager.sendEmailCode);
    app.post('/admin/api/auth/checkEmailCode', vCodeManager.checkEmailCode);
    app.post('/admin/api/auth/inviteCodeRequest', vCodeManager.inviteCodeRequest);
    app.patch(
        '/admin/api/auth/update',
        verifyToken.verifyAdminToken,
        userManager.updateuser
    ); // backend api
    app.patch(
        '/admin/api/auth/update/id/:userid',
        verifyToken.verifyAdminToken,
        userManager.updateuserwithid
    ); // backend api
    app.delete(
        '/admin/api/user/:user_id',
        verifyToken.verifyAdminToken,
        userManager.deleteUser
    ); // parameter id

    app.post(
        '/admin/api/auth/create',
        verifyToken.verifyAdminToken,
        userManager.createUserFromAdmin
    ); // backend api

    /// viewers
    app.get(
        '/admin/api/viewers/channel/:channel_id',
        verifyToken.verifyAdminToken,
        viewerManager.getViewersByChannel
    );

    /// Admin Club Apis ///
    app.get('/admin/api/clubs', clubManager.getAllClubs);
    app.post(
        '/admin/api/club/create',
        verifyToken.verifyAdminToken,
        clubManager.createclub
    );
    app.get('/admin/api/club/details/:club_id/:user_id', clubManager.getclub);
    app.get(
        '/admin/api/list/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getListByClubId
    );
    app.patch(
        '/admin/api/club/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.updateclub
    );
    app.delete(
        '/admin/api/club/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.deleteclub
    );
    app.get(
        '/admin/api/club/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getclub
    );
    app.get(
        '/admin/api/club/connect/users/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getUsersByClubId
    );
    app.delete(
        '/admin/api/club/connect/user/:club_id/:user_id',
        verifyToken.verifyAdminToken,
        clubManager.deleteConnectUserAdmin
    );
    app.get(
        '/admin/api/club/connect/clubs/user/:user_id',
        clubManager.getClubsByUserId
    );
    app.get(
        '/admin/api/clubreq/request',
        verifyToken.verifyAdminToken,
        clubManager.getClubRequest
    );
    app.get(
        '/admin/api/clubreq/requests/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getClubRequestByClubId
    );
    app.delete(
        '/admin/api/clubreq/request/:club_id/:user_id',
        verifyToken.verifyAdminToken,
        clubManager.deleteClubRequest
    );
    app.post('/admin/api/clubreq/request', clubManager.requestClub);
    app.patch(
        '/admin/api/clubreq/request',
        verifyToken.verifyAdminToken,
        clubManager.approveClubRequest
    );
    app.post(
        '/admin/api/club/manager',
        verifyToken.verifyAdminToken,
        clubManager.addClubManager
    );
    app.get(
        '/admin/api/club/manager/:user_id',
        verifyToken.verifyAdminToken,
        clubManager.getClubsByManagerId
    );
    app.get(
        '/admin/api/club/managers/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getManagersByClubId
    );

    /// Admin Club Tier Apis ///
    app.get('/admin/api/clubtiers', clubTierManager.getAllClubTiers);
    app.get(
        '/admin/api/clubtier/:id',
        verifyToken.verifyAdminToken,
        clubTierManager.getClubTier
    );
    app.post(
        '/admin/api/clubtier/create',
        verifyToken.verifyAdminToken,
        clubTierManager.createClubTier
    );
    app.patch(
        '/admin/api/clubtier/:id',
        verifyToken.verifyAdminToken,
        clubTierManager.updateClubTier
    );
    app.delete(
        '/admin/api/clubtier/:id',
        verifyToken.verifyAdminToken,
        clubTierManager.deleteClubTier
    );

    /// Admin Email Template Apis ///
    app.get('/admin/api/emailtemplates', emailTemplateManager.getAllEmailTemplates);
    app.get(
        '/admin/api/emailtemplate/:id',
        verifyToken.verifyAdminToken,
        emailTemplateManager.getEmailTemplate
    );
    app.post(
        '/admin/api/emailtemplate/create',
        verifyToken.verifyAdminToken,
        emailTemplateManager.createEmailTemplate
    );
    app.patch(
        '/admin/api/emailtemplate/:id',
        verifyToken.verifyAdminToken,
        emailTemplateManager.updateEmailTemplate
    );

    /// Admin Group Apis ///
    app.get(
        '/admin/api/groups',
        verifyToken.verifyAdminToken,
        groupManager.getAllGroups
    );
    app.post(
        '/admin/api/group/create',
        verifyToken.verifyAdminToken,
        groupManager.creategroup
    );
    app.get(
        '/admin/api/group/details/:group_id/:user_id',
        groupManager.getgroup
    );
    app.get(
        '/admin/api/list/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.getListByGroupId
    );
    app.patch(
        '/admin/api/group/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.updategroup
    );
    app.delete(
        '/admin/api/group/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.deletegroup
    );
    app.get(
        '/admin/api/group/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.getgroup
    );
    app.get(
        '/admin/api/group/connect/users/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.getUsersByGroupId
    );
    app.delete(
        '/admin/api/group/connect/user/:group_id/:user_id',
        verifyToken.verifyAdminToken,
        groupManager.deleteConnectUserAdmin
    );
    app.get(
        '/admin/api/group/connect/groups/user/:user_id',
        verifyToken.verifyAdminToken,
        groupManager.getGroupsByUserId
    );
    // app.get('/admin/api/clubreq/request', verifyToken.verifyAdminToken, groupManager.getClubRequest);
    // app.get('/admin/api/clubreq/requests/:club_id', verifyToken.verifyAdminToken, groupManager.getClubRequestByClubId);
    // app.delete('/admin/api/clubreq/request/:club_id/:user_id', verifyToken.verifyAdminToken, groupManager.deleteClubRequest);
    // app.post('/admin/api/clubreq/request', verifyToken.verifyAdminToken, groupManager.requestClub);
    // app.patch('/admin/api/clubreq/request', verifyToken.verifyAdminToken, groupManager.approveClubRequest);
    app.post(
        '/admin/api/group/manager',
        verifyToken.verifyAdminToken,
        groupManager.addGroupManager
    );
    app.get(
        '/admin/api/group/manager/:user_id',
        verifyToken.verifyAdminToken,
        groupManager.getGroupsByManagerId
    );
    app.get(
        '/admin/api/group/managers/:group_id',
        verifyToken.verifyAdminToken,
        groupManager.getManagersByGroupId
    );

    /// get all users
    app.get(
        '/admin/api/getusers',
        verifyToken.verifyAdminToken,
        userManager.getallusers
    );
    app.get(
        '/admin/api/connect/users/opposite/:opposite_id',
        verifyToken.verifyAdminToken,
        userManager.getUsersByOpoositeId
    );

    /// create assemble
    app.get(
        '/admin/api/assembles',
        verifyToken.verifyAdminToken,
        assembleManager.getassembles
    );
    app.post(
        '/admin/api/assemble/create',
        verifyToken.verifyAdminToken,
        assembleManager.createassemble
    );
    app.patch(
        '/admin/api/assemble/update/:assemble_id',
        verifyToken.verifyAdminToken,
        assembleManager.updateassemble
    );
    app.patch(
        '/admin/api/assemble/order',
        verifyToken.verifyAdminToken,
        assembleManager.updateassembleorder
    );
    app.delete(
        '/admin/api/assemble/delete/:assemble_id',
        verifyToken.verifyAdminToken,
        assembleManager.deleteassemble
    );
    app.get(
        '/admin/api/assemble/:assemble_id',
        verifyToken.verifyAdminToken,
        assembleManager.getassemble
    );

    /// Event

    app.get(
        '/admin/api/events',
        verifyToken.verifyAdminToken,
        eventManager.getEvents
    );
    app.post(
        '/admin/api/event/create',
        verifyToken.verifyAdminToken,
        eventManager.createEvent
    );
    app.patch(
        '/admin/api/event/update/:event_id',
        verifyToken.verifyAdminToken,
        eventManager.updateEvent
    );
    app.delete(
        '/admin/api/event/delete/:event_id',
        verifyToken.verifyAdminToken,
        eventManager.deleteEvent
    );
    app.get(
        '/admin/api/event/:event_id',
        verifyToken.verifyAdminToken,
        eventManager.getEvent
    );

    /// create audio
    app.get(
        '/admin/api/audios',
        verifyToken.verifyAdminToken,
        audioManager.getAudios
    );
    app.post(
        '/admin/api/audio/create',
        verifyToken.verifyAdminToken,
        audioManager.createAudio
    );
    app.patch(
        '/admin/api/audio/update/:audio_id',
        verifyToken.verifyAdminToken,
        audioManager.updateAudio
    );
    app.patch(
        '/admin/api/audio/order',
        verifyToken.verifyAdminToken,
        audioManager.updateAudioOrder
    );
    app.delete(
        '/admin/api/audio/delete/:audio_id',
        verifyToken.verifyAdminToken,
        audioManager.deleteAudio
    );
    app.get(
        '/admin/api/audio/:audio_id',
        verifyToken.verifyAdminToken,
        audioManager.getAudio
    );

    /// search podcasts
    app.get(
        '/admin/api/podcast/search',
        verifyToken.verifyAdminToken,
        audioManager.searchPodcast
    );

    /// get episodes from podcast id
    app.get(
        '/admin/api/podcasts/:podcast_id',
        verifyToken.verifyAdminToken,
        audioManager.getEpisodes
    );

    app.get(
        '/admin/api/vcodes',
        verifyToken.verifyAdminToken,
        vCodeManager.getVCodes
    );
    app.delete(
        '/admin/api/vcodes/:phone',
        verifyToken.verifyAdminToken,
        vCodeManager.deleteVCode
    );

    app.get('/admin/api/vcode/confirm/:ecode', vCodeManager.confirmCode);

    /// voice notes
    app.get(
        '/admin/api/voicenotes',
        verifyToken.verifyAdminToken,
        voiceNoteManager.getVoiceNotes
    );
    app.delete(
        '/admin/api/voicenote/:receiver_id/:voicenote_id',
        verifyToken.verifyAdminToken,
        voiceNoteManager.deleteVoiceNote
    );
    app.post(
        '/admin/api/voicenotes',
        verifyToken.verifyAdminToken,
        voiceNoteManager.createHelloVoiceNotes
    );
    app.delete(
        '/admin/api/voicenotes/:audio_id',
        verifyToken.verifyAdminToken,
        voiceNoteManager.deleteHelloVoiceNotes
    );

    /// tutor audio
    app.get(
        '/admin/api/tutoraudio',
        verifyToken.verifyAdminToken,
        audioManager.getTutorAudio
    );
    app.patch(
        '/admin/api/tutoraudio',
        verifyToken.verifyAdminToken,
        audioManager.updateTutorAudio
    );
    app.post(
        '/admin/api/tutoraudio',
        verifyToken.verifyAdminToken,
        audioManager.createTutorAudio
    );

    // Stripe
    app.get(
        '/admin/api/stripe/connect/:clubId',
        verifyToken.verifyAdminToken,
        stripeManage.getStripeConnect
    );
    app.post(
        '/admin/api/stripe/connect',
        verifyToken.verifyAdminToken,
        stripeManage.createStripeConnect
    );
    app.post(
        '/admin/api/stripe/customer',
        verifyToken.verifyAdminToken,
        stripeManage.createCustomer
    );
    app.post(
        '/admin/api/stripe/subscribe',
        verifyToken.verifyAdminToken,
        stripeManage.subScribe
    );
    app.get(
        '/admin/api/stripe/customer/:userId',
        stripeManage.getStripeCustomer
    );
    app.get(
        '/admin/api/stripe/customer/payment_methods/:customer/:type',
        verifyToken.verifyAdminToken,
        stripeManage.getPaymentMethods
    );

    app.post(
        '/admin/api/referral',
        verifyToken.verifyAdminToken,
        referralManage.createReferral
    );
    app.delete(
        '/admin/api/referral/:id',
        verifyToken.verifyAdminToken,
        referralManage.deleteReferral
    );
    app.get(
        '/admin/api/referrals',
        verifyToken.verifyAdminToken,
        referralManage.getAllReferrals
    );
    app.get(
        '/admin/api/referrals/club/:club_id',
        verifyToken.verifyAdminToken,
        referralManage.getRefferalsByClubId
    );
    app.get(
        '/admin/api/referrals/user/:user_id',
        verifyToken.verifyAdminToken,
        referralManage.getRefferalsByUserId
    );

    /// Audio Indexing
    app.post(
        '/admin/api/audio/indexing',
        verifyToken.verifyAdminToken,
        audioManager.createAudioIndexing
    );
    app.delete(
        '/admin/api/audio/indexing/:audio_id/:indexing_id',
        verifyToken.verifyAdminToken,
        audioManager.deleteAudioIndexing
    );
    app.patch(
        '/admin/api/audio/indexing/:audio_id/:indexing_id',
        verifyToken.verifyAdminToken,
        audioManager.updateAudioIndexing
    );
    app.get(
        '/admin/api/audio/indexing/:audio_id',
        verifyToken.verifyAdminToken,
        audioManager.getAudioIndexing
    );
    ///

    /// Club Room Images
    app.post(
        '/admin/api/club-room/image',
        verifyToken.verifyAdminToken,
        clubManager.createClubRoomImage
    );
    app.delete(
        '/admin/api/club-room/image/:club_id/:image_id',
        verifyToken.verifyAdminToken,
        clubManager.deleteClubRoomImage
    );
    app.get(
        '/admin/api/club-room/images/:club_id',
        verifyToken.verifyAdminToken,
        clubManager.getClubRoomImages
    );
    ///
};
