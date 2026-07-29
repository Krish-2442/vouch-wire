#!/bin/bash
set -e

echo "Waiting for MongoDB to accept connections..."
until mongosh --host mongodb:27017 --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 1
done
echo "MongoDB is accepting connections."

RS_STATUS=$(mongosh --host mongodb:27017 --quiet --eval "
    try {
        const status = rs.status();
        print('INITIALIZED');
    } catch (e) {
        print('NOT_INITIALIZED');
    }
")

if [ "$RS_STATUS" = "INITIALIZED" ]; then
    echo "Replica set rs0 is already initialized."
else
    echo "Initializing replica set rs0..."
    mongosh --host mongodb:27017 --quiet --eval "
        rs.initiate({
            _id: 'rs0',
            members: [{ _id: 0, host: 'mongodb:27017' }]
        });
    "
    echo "Replica set rs0 initiated."
fi

echo "Waiting for rs0 primary to become writable..."
for i in $(seq 1 30); do
    IS_PRIMARY=$(mongosh --host mongodb:27017 --quiet --eval "
        const hello = db.hello();
        if (hello.isWritablePrimary) { print('true'); } else { print('false'); }
    ")
    if [ "$IS_PRIMARY" = "true" ]; then
        echo "rs0 primary is writable."
        exit 0
    fi
    sleep 1
done

echo "ERROR: rs0 did not elect a writable primary within 30 seconds."
exit 1
