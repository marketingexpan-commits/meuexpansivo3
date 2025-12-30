try {
    require('./functions/smsScheduler');
    console.log("Syntax OK");
} catch (e) {
    console.error(e);
}
