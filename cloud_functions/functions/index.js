const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const calculate = require('geofire');

exports.alertUsers = functions.region('europe-west1').firestore.document('alerts/{alertsId}').onCreate((change, context) => {
    let payload = {
        data: {
            title: 'Alert',
            message: 'Cloud function works'
        }
    };
    let counter = 0;
    let mainLocation = [change.data()['location'].latitude, change.data()['location'].longitude];
    db.collection('users').get()
        // eslint-disable-next-line promise/always-return
        .then(snapshot => {
            snapshot.forEach(doc => {
                let userId = doc.id;
                db.collection('pending').doc(userId).get()
                    // eslint-disable-next-line promise/always-return
                    .then(pendingUser => {
                        db.collection('active').doc(userId).get()
                            .then(activeUser => {
                                // eslint-disable-next-line promise/always-return
                                if (!pendingUser.exists && !activeUser.exists) {
                                    let userLocation = [doc.data()['location'].latitude, doc.data()['location'].longitude];
                                    let distance = calculate.GeoFire.distance(mainLocation, userLocation);
                                    if (distance <= change.data()['maxDistance']) {
                                        admin.messaging().sendToDevice(doc.data()['token'], payload)
                                            // eslint-disable-next-line promise/always-return
                                            .then(() => {
                                                let pendingData = {
                                                    alertId: change.id
                                                };
                                                db.collection('pending').doc(userId).set(pendingData)
                                                    .then()
                                                    .catch();
                                            })
                                            .catch(err => {
                                                return console.log('Error sending message:', err);
                                            });
                                        counter++;
                                    }
                                }
                            })
                            .catch();
                    })
                    .catch();
                return counter > change.data()['maxUsers'];
            });
        })
        .catch(err => {
            console.log('Error getting documents', err);
        });
});

exports.activatingAlert = functions.region('europe-west1').firestore.document('active/{activeId}').onCreate((change, context) => {
    db.collection('pending').where('alertId', '==', change.data()['alertId']).delete()
        .then()
        .catch();
    db.collection('alerts').doc(change.data()['alertId']).delete()
        .then()
        .catch();
});