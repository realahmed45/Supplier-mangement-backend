
const mongoose = require('mongoose');

async function dropBadIndex() {
  await mongoose.connect('mongodb+srv://chatbiz50_db_user:dtorU38nkLmTNdy8@cluster0.ehikyfh.mongodb.net/?appName=Cluster0');
  try {
     const db = mongoose.connection.db;
     const usersColl = db.collection('users');
     
     console.log('Dropping username_1 index from users collection...');
     try {
       await usersColl.dropIndex('username_1');
       console.log('Index username_1 dropped successfully.');
     } catch(e) {
       console.log('Index did not exist or could not be dropped:', e.message);
     }
  } catch(e) {
     console.error('Error:', e);
  } finally {
     await mongoose.disconnect();
  }
}
dropBadIndex();

